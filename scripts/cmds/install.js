module.exports.config = {
    name: "install",
    version: "2.5.0",
    role: 2,
    credits: "Ariful Islam Sabbir",
    description: "Temporary cache-e command install koro (Text reply ba File)",
    usePrefix: true,
    category: "Admin",
    usages: "install (code text-e reply dao ba .js file pathao)",
    cooldowns: 5,
};

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const TTL_MS = 5 * 60 * 1000; 
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
    const dir = path.join(process.cwd(), "tmp", "install_cache", "cmds");
    fs.ensureDirSync(dir);

    if (global.GoatBot.tempInstalls.has(name)) cleanupTempInstall(name);

    const filePath = path.join(dir, `${name}.js`);
    fs.writeFileSync(filePath, sourceCode, "utf8");

    let mod;
    try {
        delete require.cache[require.resolve(filePath)];
        mod = require(filePath);
    } catch (err) {
        try { fs.removeSync(filePath); } catch (e) {}
        throw new Error(`❌ Load Error: ${err.message}`);
    }

    if (!mod.config || !mod.config.name || !mod.onStart) {
        try { fs.removeSync(filePath); } catch (e) {}
        throw new Error("❌ Invalid format: 'config.name' & 'onStart' proyojon!");
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mod.__tempInstallId = id;
    mod.location = filePath;

    global.GoatBot.commands.set(name, mod);
    if (mod.config.aliases) {
        for (const al of mod.config.aliases) global.GoatBot.aliases.set(al, name);
    }

    const timeoutHandle = setTimeout(() => cleanupTempInstall(name), TTL_MS);
    global.GoatBot.tempInstalls.set(name, {
        id, type: "cmd", filePath, timeoutHandle,
        expiresAt: Date.now() + TTL_MS,
        aliases: mod.config.aliases || []
    });

    return api.sendMessage(`✅ Installed: ${name}\n⏳ Expire hobe: ${fmtMs(TTL_MS)}`, threadID, messageID);
}

module.exports.onReply = async function ({ api, event, Reply }) {
    if (event.senderID !== Reply.author) return;
    if (event.body.toLowerCase() === "delet") {
        await performInstall(Reply.name, Reply.sourceCode, "cmd", `${Reply.name}.js`, api, event.threadID, event.messageID);
        api.unsendMessage(Reply.messageID);
    }
};

module.exports.onStart = async function ({ api, event, args }) {
    const { threadID, messageID, attachments, messageReply, senderID } = event;
    let sourceCode = "";
    let name = (args[0] || "").toLowerCase().replace(/.js$/i, "");

    // 1. Jodi text code-e reply deya hoy
    if (messageReply && messageReply.body && !messageReply.attachments?.length) {
        sourceCode = messageReply.body;
    } 
    // 2. Jodi file attachment-e reply deya hoy
    else {
        const jsFile = [...(attachments || []), ...(messageReply?.attachments || [])].find(a => 
            a.name?.endsWith(".js") || a.filename?.endsWith(".js") || a.type === "file"
        );
        
        if (jsFile) {
            try {
                const res = await axios.get(jsFile.url, { responseType: "arraybuffer" });
                sourceCode = Buffer.from(res.data).toString("utf8");
                if (!name) name = (jsFile.name || jsFile.filename || "").replace(/.js$/i, "").toLowerCase();
            } catch (e) { return api.sendMessage("❌ Download failed", threadID); }
        }
    }

    if (!sourceCode) return api.sendMessage("❌ Code paowa jay nai! Code-er upor reply din ba file attach korun।", threadID, messageID);
    if (!name) return api.sendMessage("❌ Command-er ekta nam din! Udahoron: /install test", threadID, messageID);

    if (global.GoatBot.commands.has(name) && !global.GoatBot.tempInstalls.has(name)) {
        return api.sendMessage(`⚠️ "${name}" nam-e permanent command ache। "delet" likhe reply din replace korte।`, threadID, (err, info) => {
            global.GoatBot.onReply.set(info.messageID, { commandName: "install", messageID: info.messageID, author: senderID, name, sourceCode });
        }, messageID);
    }

    try {
        await performInstall(name, sourceCode, "cmd", `${name}.js`, api, threadID, messageID);
    } catch (err) {
        api.sendMessage(err.message, threadID, messageID);
    }
};
