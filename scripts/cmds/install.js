module.exports.config = {
    name: "install",
    version: "4.0.0",
    role: 2,
    credits: "Ariful Islam Sabbir",
    description: "Advanced Temporary Installer (Handles Snippets)",
    usePrefix: true,
    category: "Admin",
    usages: "install <name> (কোডের ওপর রিপ্লাই দিন)",
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
    if (global.GoatBot.commands.has(name)) global.GoatBot.commands.delete(name);
    try {
        if (entry.filePath && fs.existsSync(entry.filePath)) {
            delete require.cache[require.resolve(entry.filePath)];
            fs.removeSync(entry.filePath);
        }
    } catch (e) {}
}

async function performInstall(name, sourceCode, api, threadID, messageID) {
    fs.ensureDirSync(CACHE_DIR);
    if (global.GoatBot.tempInstalls.has(name)) cleanupTempInstall(name);

    const filePath = path.join(CACHE_DIR, `${name}.js`);
    fs.writeFileSync(filePath, sourceCode, "utf8");

    let mod;
    try {
        delete require.cache[require.resolve(filePath)];
        mod = require(filePath);
    } catch (err) {
        try { fs.removeSync(filePath); } catch (e) {}
        throw new Error(`❌ কোডে ভুল আছে:\n${err.message}`);
    }

    if (!mod.config || !mod.onStart) {
        try { fs.removeSync(filePath); } catch (e) {}
        throw new Error("❌ ইনভ্যালিড ফরম্যাট! config এবং onStart নেই।");
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mod.__tempInstallId = id;
    mod.location = filePath;
    global.GoatBot.commands.set(name, mod);
    
    const timeoutHandle = setTimeout(() => cleanupTempInstall(name), TTL_MS);
    global.GoatBot.tempInstalls.set(name, { id, filePath, timeoutHandle });

    return api.sendMessage(`✅ সফলভাবে ইনস্টল হয়েছে!\n📌 নাম: ${name}\n⏳ স্থায়িত্ব: ${fmtMs(TTL_MS)}`, threadID, messageID);
}

module.exports.onReply = async function ({ api, event, Reply }) {
    if (event.senderID !== Reply.author) return;
    if (event.body.toLowerCase() === "delet") {
        await performInstall(Reply.name, Reply.sourceCode, api, event.threadID, event.messageID);
        api.unsendMessage(Reply.messageID);
    }
};

module.exports.onStart = async function ({ api, event, args }) {
    const { threadID, messageID, messageReply, senderID, attachments } = event;
    let sourceCode = "";
    let name = (args[0] || "").toLowerCase().replace(/.js$/i, "");

    if (messageReply) {
        // ১. রিপ্লাই করা মেসেজের বডি চেক
        sourceCode = messageReply.body || "";
        
        // ২. যদি বডিতে কোড না থাকে (স্নিনিপেট সমস্যা), তবে আর্গুমেন্ট চেক করবে
        if (sourceCode.length < 50 && messageReply.args) {
            sourceCode = messageReply.args.join(" ");
        }

        // ৩. যদি ফাইল হয়
        const file = [...(attachments || []), ...(messageReply.attachments || [])].find(a => a.type === "file" || a.name?.endsWith(".js"));
        if (file && sourceCode.length < 50) {
            try {
                const res = await axios.get(file.url, { responseType: "text" });
                sourceCode = res.data;
            } catch (e) {}
        }
    }

    if (!sourceCode || sourceCode.length < 10) {
        return api.sendMessage("❌ কোড পড়া সম্ভব হচ্ছে না! পুরো কোডটি টেক্সট হিসেবে লিখে তার ওপর রিপ্লাই দিন।", threadID, messageID);
    }

    if (!name) return api.sendMessage("❌ নাম দিন। যেমন: /install test", threadID, messageID);

    if (global.GoatBot.commands.has(name) && !global.GoatBot.tempInstalls.has(name)) {
        return api.sendMessage(`⚠️ "${name}" পার্মানেন্ট কমান্ড। মুছতে চাইলে "delet" লিখে রিপ্লাই দিন।`, threadID, (err, info) => {
            global.GoatBot.onReply.set(info.messageID, { commandName: "install", author: senderID, name, sourceCode, messageID: info.messageID });
        }, messageID);
    }

    try {
        await performInstall(name, sourceCode, api, threadID, messageID);
    } catch (err) {
        api.sendMessage(err.message, threadID, messageID);
    }
};
