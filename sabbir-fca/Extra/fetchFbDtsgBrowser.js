/**
 * Headless-browser fb_dtsg recovery.
 *
 * Modern Facebook ships `["DTSGInitData",[],{"token":"","async_get_token":""}]`
 * in the initial HTML. The real token is fetched async by the page's own
 * JavaScript runtime, which `request`-style scrapers cannot execute.
 *
 * This module spins up headless Chromium, replays the appstate cookies,
 * loads facebook.com so the page's JS runs, and extracts:
 *   - fb_dtsg
 *   - jazoest (if present in any form)
 *   - the post-navigation cookie set (in case xs / c_user got rotated)
 *
 * It deliberately uses puppeteer-core + the system Chromium that the Replit
 * Nix environment provides; no Chromium download is performed at runtime.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let _puppeteer;
function getPuppeteer() {
    if (!_puppeteer) _puppeteer = require('puppeteer-core');
    return _puppeteer;
}

/**
 * Default browser fingerprint shared by both the headless browser and the
 * FCA HTTP layer. Keeping these in one place is important: Facebook's anti-
 * automation pipeline correlates the User-Agent + sec-ch-ua client hints +
 * Accept-Language across requests. If the browser launches as Chrome 138 but
 * the FCA HTTP requests claim to be Chrome 103, the session is flagged.
 */
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const DEFAULT_SEC_CH_UA = '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"';
const DEFAULT_SEC_CH_UA_MOBILE = '?0';
const DEFAULT_SEC_CH_UA_PLATFORM = '"Windows"';
const DEFAULT_ACCEPT_LANGUAGE = 'en-US,en;q=0.9,bn;q=0.8';

function resolveChromiumExecutable() {
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
        return process.env.CHROME_PATH;
    }
    try {
        const out = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null || true', { encoding: 'utf8' }).trim();
        if (out && fs.existsSync(out)) return out;
    } catch (e) {}
    return null;
}

function appstateToPuppeteerCookies(appstate) {
    if (!Array.isArray(appstate)) return [];
    return appstate
        .map(c => {
            const name = c.key || c.name;
            if (!name) return null;
            // Normalize the domain. Puppeteer matches strictly, and tough-cookie
            // appstates often store "facebook.com" (no leading dot). Force the
            // ".facebook.com" form so the cookie is sent for www/m/business etc.
            let domain = c.domain || '.facebook.com';
            if (domain && domain[0] !== '.' && !/^[0-9.]+$/.test(domain)) {
                domain = '.' + domain.replace(/^\./, '');
            }
            return {
                name,
                value: String(c.value),
                // `url` is the canonical anchor puppeteer uses when domain/path
                // resolution would otherwise fail. Without it, setCookie will
                // silently reject the entry on a brand-new about:blank page.
                url: 'https://www.facebook.com/',
                domain,
                path: c.path || '/',
                httpOnly: !!c.httpOnly,
                secure: c.secure !== false,
                sameSite: 'Lax',
            };
        })
        .filter(Boolean);
}

/**
 * @param {Array} appstate Facebook appstate (cookie array)
 * @param {Object} [opts]
 * @param {number} [opts.timeoutMs=30000] Total page-load timeout.
 * @param {number} [opts.extractTimeoutMs=20000] How long to poll the page for fb_dtsg.
 * @param {string} [opts.userAgent] Override the UA.
 * @returns {Promise<{ token: string|null, source: string|null, jazoest: string|null, cookies: any[], error?: string }>}
 */
async function fetchFbDtsgViaBrowser(appstate, opts = {}) {
    const exe = resolveChromiumExecutable();
    if (!exe) {
        return { token: null, source: null, jazoest: null, cookies: [], error: 'chromium executable not found (set PUPPETEER_EXECUTABLE_PATH)' };
    }

    const puppeteer = getPuppeteer();
    let browser;
    try {
        // NOTE: deliberately NOT passing --single-process / --no-zygote here.
        // Those flags speed up cold-start but cause Chromium to silently drop
        // some Set-Cookie writes from Facebook's response, which makes the
        // post-navigation cookie diff useless.
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: exe,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process,AutomationControlled',
                '--lang=en-US,en',
                '--window-size=1280,800',
            ],
        });

        const page = await browser.newPage();
        const ua = opts.userAgent || DEFAULT_UA;
        await page.setUserAgent(ua);
        await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
        await page.setExtraHTTPHeaders({
            'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
            'sec-ch-ua': DEFAULT_SEC_CH_UA,
            'sec-ch-ua-mobile': DEFAULT_SEC_CH_UA_MOBILE,
            'sec-ch-ua-platform': DEFAULT_SEC_CH_UA_PLATFORM,
            'Upgrade-Insecure-Requests': '1',
        });

        // Stealth patches: mask the most common automation fingerprints before
        // any page script runs. Facebook invalidates the session on first
        // navigation if it sees navigator.webdriver === true, an empty plugins
        // array, or a missing window.chrome object.
        await page.evaluateOnNewDocument(() => {
            try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch (e) {}
            try { Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'bn'] }); } catch (e) {}
            try { Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] }); } catch (e) {}
            try { Object.defineProperty(navigator, 'platform', { get: () => 'Win32' }); } catch (e) {}
            try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); } catch (e) {}
            try { Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); } catch (e) {}
            try { Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 }); } catch (e) {}
            try {
                const orig = window.navigator.permissions && window.navigator.permissions.query;
                if (orig) {
                    window.navigator.permissions.query = (p) =>
                        p && p.name === 'notifications'
                            ? Promise.resolve({ state: Notification.permission })
                            : orig(p);
                }
            } catch (e) {}
            try {
                window.chrome = window.chrome || {};
                window.chrome.runtime = window.chrome.runtime || {};
                window.chrome.app = window.chrome.app || { isInstalled: false };
            } catch (e) {}
            // WebGL vendor / renderer spoof so the GPU fingerprint doesn't shout
            // "headless".
            try {
                const getParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) return 'Intel Inc.';
                    if (parameter === 37446) return 'Intel Iris OpenGL Engine';
                    return getParameter.apply(this, arguments);
                };
            } catch (e) {}
        });

        const ckArr = appstateToPuppeteerCookies(appstate);
        console.log("[FCA-BROWSER] cookies prepared from appstate: " + ckArr.map(c => c.name + "(len=" + (c.value||'').length + ")").join(','));
        if (ckArr.length) {
            // Set cookies twice: once via the page API (with domain), and once via
            // the CDP Network.setCookies which behaves more like a real browser
            // session restore. Either path can fail silently on certain cookie
            // shapes, so we try both.
            try { await page.setCookie(...ckArr); }
            catch (e) { console.log("[FCA-BROWSER] page.setCookie warn: " + (e && e.message)); }
            try {
                const client = await page.target().createCDPSession();
                await client.send('Network.setCookies', {
                    cookies: ckArr.map(c => ({
                        name: c.name,
                        value: c.value,
                        domain: c.domain,
                        path: c.path,
                        httpOnly: c.httpOnly,
                        secure: c.secure,
                        sameSite: 'Lax',
                    })),
                });
                await client.detach();
            } catch (e) { console.log("[FCA-BROWSER] CDP setCookies warn: " + (e && e.message)); }
            // Sanity check the browser jar BEFORE the navigation. If c_user/xs are
            // already missing here, our setCookie was silently rejected (encoding
            // issue). If they vanish only AFTER the navigation, Facebook itself
            // expired them via a Set-Cookie reply (= appstate is dead).
            try {
                const preCookies = await page.cookies('https://www.facebook.com');
                console.log("[FCA-BROWSER] PRE-nav page.cookies: [" + preCookies.map(c => c.name).join(',') + "]");
            } catch (e) {}
        }

        try {
            await page.goto('https://www.facebook.com/', {
                waitUntil: 'domcontentloaded',
                timeout: opts.timeoutMs || 30000,
            });
        } catch (eGoto) {
            console.log("[FCA-BROWSER] page.goto warn: " + (eGoto && eGoto.message));
        }
        try {
            const finalUrl = page.url();
            const title = await page.title();
            const bodyLen = await page.evaluate(() => (document.body && document.body.innerText || '').length);
            const hasLoginForm = await page.evaluate(() => !!document.querySelector('form[action*="login"], input[name="email"][type="text"], input[name="pass"]'));
            const hasLogoutLink = await page.evaluate(() => !!document.querySelector('a[href*="logout"], [aria-label*="ccount"]'));
            const isWebDriver = await page.evaluate(() => !!navigator.webdriver);
            const cookieList = await page.evaluate(() => document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(Boolean).join(','));
            const browserCookies = await page.cookies('https://www.facebook.com');
            const browserCookieKeys = browserCookies.map(c => c.name).join(',');
            console.log("[FCA-BROWSER] post-nav url=" + finalUrl + " title=\"" + title + "\" bodyChars=" + bodyLen + " loginForm=" + hasLoginForm + " logoutLink=" + hasLogoutLink + " webdriver=" + isWebDriver);
            console.log("[FCA-BROWSER] document.cookie keys: [" + cookieList + "]");
            console.log("[FCA-BROWSER] page.cookies keys:    [" + browserCookieKeys + "]");
        } catch (eDiag) {}

        const extractTimeout = opts.extractTimeoutMs || 20000;
        const result = await page.evaluate((deadlineMs) => {
            return new Promise((resolve) => {
                const start = Date.now();
                const tryExtract = () => {
                    // 1) The Lightspeed/__d module loader
                    try {
                        if (typeof require === 'function') {
                            const m = require('DTSGInitialData');
                            if (m && m.token) return resolve({ source: 'require:DTSGInitialData', token: m.token });
                        }
                    } catch (e) {}
                    try {
                        if (typeof require === 'function') {
                            const m = require('DTSG_ASYNC');
                            if (m && m.token) return resolve({ source: 'require:DTSG_ASYNC', token: m.token });
                        }
                    } catch (e) {}
                    // 2) Hidden form input
                    const inp = document.querySelector('input[name="fb_dtsg"]');
                    if (inp && inp.value) return resolve({ source: 'input', token: inp.value });
                    // 3) Inline script bodies
                    const scripts = document.querySelectorAll('script');
                    for (const s of scripts) {
                        const txt = s.textContent || '';
                        let m = txt.match(/"DTSGInitialData"[^}]{0,200}"token":"([^"]{20,})"/);
                        if (m) return resolve({ source: 'script:DTSGInitialData', token: m[1] });
                        m = txt.match(/\["DTSGInitData",\[\],\{"token":"([^"]{20,})"/);
                        if (m) return resolve({ source: 'script:DTSGInitData', token: m[1] });
                        m = txt.match(/"async_get_token":"([^"]{20,})"/);
                        if (m) return resolve({ source: 'script:async_get_token', token: m[1] });
                    }
                    if (Date.now() - start < deadlineMs) {
                        setTimeout(tryExtract, 250);
                    } else {
                        resolve(null);
                    }
                };
                tryExtract();
            });
        }, extractTimeout);

        const jazoest = await page.evaluate(() => {
            const inp = document.querySelector('input[name="jazoest"]');
            return inp ? inp.value : null;
        }).catch(() => null);

        let cookies = [];
        try { cookies = await page.cookies('https://www.facebook.com'); } catch (e) {}

        return {
            token: result ? result.token : null,
            source: result ? result.source : null,
            jazoest,
            cookies,
        };
    } catch (e) {
        return { token: null, source: null, jazoest: null, cookies: [], error: e && e.message };
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
    }
}

module.exports = {
    fetchFbDtsgViaBrowser,
    resolveChromiumExecutable,
    DEFAULT_UA,
    DEFAULT_SEC_CH_UA,
    DEFAULT_SEC_CH_UA_MOBILE,
    DEFAULT_SEC_CH_UA_PLATFORM,
    DEFAULT_ACCEPT_LANGUAGE,
};
