const moment = require("moment-timezone");

const TIMEZONE = "Asia/Dhaka";
const STATE_KEY = "__hourlyTimeAnnouncerStarted";

module.exports.config = {
        name: "hourlyTime",
        version: "1.0.0",
        role: 0,
        credits: "Ariful Islam Sabbir",
        description: "Proti gontay shob active group e Dhaka time announce kore (hidden / background event)",
        category: "Events",
        countDown: 0,
        hidden: true,
        usePrefix: false
};

function bn(num) {
        const map = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
        return String(num).split("").map(c => /\d/.test(c) ? map[c] : c).join("");
}

function buildMessage() {
        const now = moment().tz(TIMEZONE);
        const hour12 = now.format("h");
        const minute = now.format("mm");
        const ampmEn = now.format("A");
        const ampmBn = ampmEn === "AM" ? "সকাল/রাত" : "দুপুর/সন্ধ্যা";
        const dateStr = now.format("dddd, DD MMMM YYYY");

        const h = parseInt(now.format("H"), 10);
        let greet = "🌙";
        if (h >= 5 && h < 12) greet = "🌅 শুভ সকাল";
        else if (h >= 12 && h < 16) greet = "☀️ শুভ দুপুর";
        else if (h >= 16 && h < 19) greet = "🌇 শুভ বিকাল";
        else if (h >= 19 && h < 23) greet = "🌃 শুভ সন্ধ্যা";
        else greet = "🌙 শুভ রাত্রি";

        return (
                `${greet}!\n` +
                `━━━━━━━━━━━━━━\n` +
                `🕐 এখন সময়: ${bn(hour12)}:${bn(minute)} ${ampmBn === "সকাল/রাত" ? (h < 5 ? "রাত" : "সকাল") : (h < 16 ? "দুপুর" : (h < 19 ? "বিকাল" : "সন্ধ্যা"))}\n` +
                `📅 তারিখ: ${dateStr} (Dhaka)\n` +
                `━━━━━━━━━━━━━━\n` +
                `— SABBIR CHAT BOT`
        );
}

async function broadcast(api) {
        try {
                const text = buildMessage();
                const allThreadData = (global.db && global.db.allThreadData) ? global.db.allThreadData : [];
                const groupThreads = allThreadData
                        .filter(t => t && t.threadID && t.isGroup !== false)
                        .map(t => String(t.threadID));

                let targets = groupThreads;
                if (targets.length === 0) {
                        try {
                                const list = await new Promise((resolve, reject) => {
                                        api.getThreadList(50, null, ["INBOX"], (err, l) => err ? reject(err) : resolve(l || []));
                                });
                                targets = list.filter(t => t && t.isGroup).map(t => String(t.threadID));
                        } catch (e) { /* ignore */ }
                }

                for (const tid of targets) {
                        try {
                                await new Promise(r => setTimeout(r, 500));
                                api.sendMessage(text, tid, (err) => {
                                        if (err) console.log(`[hourlyTime] failed for ${tid}:`, err.message || err);
                                });
                        } catch (e) {
                                console.log(`[hourlyTime] send error for ${tid}:`, e.message || e);
                        }
                }
                console.log(`[hourlyTime] Broadcast sent to ${targets.length} group(s) at ${moment().tz(TIMEZONE).format("HH:mm")}`);
        } catch (e) {
                console.log("[hourlyTime] broadcast error:", e.message || e);
        }
}

function scheduleHourly(api) {
        const now = moment().tz(TIMEZONE);
        const nextHour = now.clone().add(1, "hour").startOf("hour");
        const msUntilNext = nextHour.diff(now);

        console.log(`[hourlyTime] Scheduled. Next announce in ${Math.round(msUntilNext / 1000)}s (at ${nextHour.format("HH:mm")} Dhaka).`);

        setTimeout(() => {
                broadcast(api);
                setInterval(() => broadcast(api), 60 * 60 * 1000);
        }, msUntilNext);
}

module.exports.onStart = async function ({ api, event }) {
        if (global[STATE_KEY]) return;
        global[STATE_KEY] = true;
        scheduleHourly(api);
};

module.exports.onLoad = async function ({ api } = {}) {
        if (global[STATE_KEY]) return;
        if (!api && global.GoatBot && global.GoatBot.fcaApi) api = global.GoatBot.fcaApi;
        if (!api) return;
        global[STATE_KEY] = true;
        scheduleHourly(api);
};
