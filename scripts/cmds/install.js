module.exports.config = {
    name: "install",
    version: "2.1.0",
    role: 2,
    credits: "Ariful Islam Sabbir",
    description: "Temporary cache-e command install koro (5 min TTL)",
    usePrefix: true,
    category: "Admin",
    usages: "install (.js file attach koro)",
    cooldowns: 5,
};

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_DIR = path.join(process.cwd(), "tmp", "install_cache", "cmds");

global.GoatBot = global.GoatBot || {};
global.GoatBot.tempInstalls = global.GoatBot.tempInstalls || new Map();

function fmtMs(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${s}s`;
}

function cleanupTempInstall(name) {
    const entry = global.GoatBot.tempInstalls.get(name);
    if (!entry) return;
    clearTimeout(entry.timeoutHandle);
    global.GoatBot.tempInstalls.delete(name);

    if (entry.type === "cmd") {
        const cur = global.GoatBot.commands.get(name);
        if (cur && cur.__tempInstallId === entry.id) {
            global.GoatBot.commands.delete(name);
            const idxChat = global.GoatBot.onChat.indexOf(name);
            if (idxChat !== -1) global.GoatBot.onChat.splice(idxChat, 1);
            const idxEv = global.GoatBot.onEvent.indexOf(name);
            if (idxEv !== -1) global.GoatBot.onEvent.splice(idxEv, 1);
        }
        for (const al of entry.aliases || []) {
            if (global.GoatBot.aliases.get(al) === name) global.GoatBot.aliases.delete(al);
        }
    }

    try {
        if (entry.filePath && fs.existsSync(entry.filePath)) {
            delete require.cache[require.resolve(entry.filePath)];
            fs.removeSync(entry.filePath);
        }
    } catch (e) {}
}

async function performInstall(name, sourceCode, type, filename, api, threadID, messageID) {
    const dir = type === "event" ? path.join(process.cwd(), "tmp", "install_cache", "events") : CACHE_DIR;
    fs.ensureDirSync(dir);

    if (global.GoatBot.tempInstalls.has(name)) {
        cleanupTempInstall(name);
    }

    const filePath = path.join(dir, `${name}.js`);
    fs.writeFileSync(filePath, sourceCode, "utf8");

    let mod;
    try {
        delete require.cache[require.resolve(filePath)];
        mod = require(filePath);
    } catch (err) {
        try { fs.removeSync(filePath); } catch (e) {}
        const isSyntax = err && (err.name === "SyntaxError" || /SyntaxError|Unexpected/i.test(err.message || ""));
        throw new Error(`${isSyntax ? "❌ Syntax Error" : "❌ Load Error"}\n${err.message}`);
    }

    if (!mod || !mod.config || !mod.config.name || !mod.onStart) {
        try { fs.removeSync(filePath); } catch (e) {}
        throw new Error("❌ Invalid format: 'config.name' ebong 'onStart' duto-i proyojon!");
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mod.__tempInstallId = id;
    mod.location = filePath;

    const aliases = Array.isArray(mod.config.aliases) ? mod.config.aliases.slice() : [];

    global.GoatBot.commands.set(name, mod);
    for (const al of aliases) global.GoatBot.aliases.set(al, name);
    if (mod.onChat && !global.GoatBot.onChat.includes(name)) global.GoatBot.onChat.push(name);
    if (mod.onEvent && !global.GoatBot.onEvent.includes(name)) global.GoatBot.onEvent.push(name);

    const timeoutHandle = setTimeout(() => cleanupTempInstall(name), TTL_MS);
    if (timeoutHandle.unref) timeoutHandle.unref();

    global.GoatBot.tempInstalls.set(name, {
        id, type: "cmd", filePath, timeoutHandle,
        expiresAt: Date.now() + TTL_MS,
        aliases,
        filename: filename || `${name}.js`,
    });

    const aliasNote = aliases.length ? `\n🔗 Aliases: ${aliases.join(", ")}` : "";
    return api.sendMessage(
        `✅ Installed (TEMP CACHE)\n📌 Command: ${global.GoatBot.config.prefix}${name}\n⏳ TTL: ${fmtMs(TTL_MS)} (auto-remove)${aliasNote}`,
        threadID, messageID
    );
}

module.exports.onReply = async function ({ api, event, Reply }) {
    if (event.senderID !== Reply.author) return;
    if (event.body.toLowerCase() === "delet") {
        const { name, sourceCode, fileName } = Reply;
        if (global.GoatBot.commands.has(name)) {
            global.GoatBot.commands.delete(name);
        }
        await performInstall(name, sourceCode, "cmd", fileName, api, event.threadID, event.messageID);
        api.unsendMessage(Reply.messageID);
    }
};

module.exports.onStart = async function ({ api, event, args }) {
    const { threadID, messageID, attachments, messageReply, senderID } = event;

    const requestedName = (args[0] || "").trim().toLowerCase().replace(/.js$/i, "");
    const allAttachments = [...(attachments || []), ...((messageReply && messageReply.attachments) || [])];
    
    const jsFile = allAttachments.find(a => 
        (a?.url) && (a.name?.toLowerCase().endsWith(".js") || a.filename?.toLowerCase().endsWith(".js"))
    );

    if (!jsFile) return api.sendMessage("❌ JS file paowa jay nai!", threadID, messageID);

    const fileName = jsFile.name || jsFile.filename;
    const name = (requestedName || fileName.replace(/.js$/i, "")).toLowerCase();

    // Check if command already exists and it's NOT a temp install
    if (global.GoatBot.commands.has(name) && !global.GoatBot.tempInstalls.has(name)) {
        let sourceCode;
        try {
            const res = await axios.get(jsFile.url, { responseType: "arraybuffer" });
            sourceCode = Buffer.from(res.data).toString("utf8");
        } catch (e) { return api.sendMessage("❌ Download failed.", threadID); }

        return api.sendMessage(
            `⚠️ Ei file ti age theke ache (${name}.js)\n\nPurono file muche notun kore install korte chaile "delet" likhe reply din.`,
            threadID,
            (err, info) => {
                global.GoatBot.onReply.set(info.messageID, {
                    commandName: module.exports.config.name,
                    messageID: info.messageID,
                    author: senderID,
                    name,
                    sourceCode,
                    fileName
                });
            },
            messageID
        );
    }

    try {
        const res = await axios.get(jsFile.url, { responseType: "arraybuffer" });
        const sourceCode = Buffer.from(res.data).toString("utf8");
        await performInstall(name, sourceCode, "cmd", fileName, api, threadID, messageID);
    } catch (err) {
        return api.sendMessage(err.message, threadID, messageID);
    }
};
