module.exports.config = {
    name: "install",
    version: "7.5.0",
    role: 2,
    credits: "Ariful Islam Sabbir",
    description: "Fake Animation সহ সরাসরি বা রিপ্লাই দিয়ে ইনস্টল করুন",
    usePrefix: true,
    category: "Admin",
    usages: "install <name> <code_here>",
    cooldowns: 1, // Cooldown কমিয়ে ১ সেকেন্ড করা হয়েছে যাতে আটকে না যায়
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

async function performInstallLogic(name, sourceCode) {
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
        throw new Error(err.message);
    }

    if (!mod.config || !mod.onStart) {
        try { fs.removeSync(filePath); } catch (e) {}
        throw new Error("Invalid Format! config বা onStart নেই।");
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mod.__tempInstallId = id;
    mod.location = filePath;
    global.GoatBot.commands.set(name, mod);
    
    const timeoutHandle = setTimeout(() => cleanupTempInstall(name), TTL_MS);
    global.GoatBot.tempInstalls.set(name, { id, filePath, timeoutHandle });
    return true;
}

module.exports.onReply = async function ({ api, event, Reply }) {
    if (event.senderID !== Reply.author) return;
    if (event.body.toLowerCase() === "delet") {
        try {
            await performInstallLogic(Reply.name, Reply.sourceCode);
            api.unsendMessage(Reply.messageID);
            api.sendMessage(`✅ Updated Successfully: ${Reply.name}`, event.threadID);
        } catch (e) {
            api.sendMessage(`❌ এরর: ${e.message}`, event.threadID);
        }
    }
};

module.exports.onStart = async function ({ api, event, args }) {
    const { threadID, messageID, messageReply, senderID, attachments } = event;
    let sourceCode = "";
    let name = (args[0] || "").toLowerCase().replace(/.js$/i, "");

    if (args.length > 1) {
        sourceCode = event.body.slice(event.body.indexOf(args[1]));
    } else if (messageReply) {
        sourceCode = messageReply.body || (messageReply.args ? messageReply.args.join(" ") : "");
        const file = [...(attachments || []), ...(messageReply.attachments || [])].find(a => a.type === "file");
        if (file && !sourceCode) {
            try {
                const res = await axios.get(file.url, { responseType: "text" });
                sourceCode = res.data;
            } catch (e) {}
        }
    }

    if (!sourceCode || sourceCode.length < 10) return api.sendMessage("❌ কোড খুঁজে পাওয়া যায়নি!", threadID, messageID);
    if (!name) return api.sendMessage("❌ নাম দিন: /install <name>", threadID, messageID);

    if (global.GoatBot.commands.has(name) && !global.GoatBot.tempInstalls.has(name)) {
        return api.sendMessage(`⚠️ "${name}" পার্মানেন্ট কমান্ড। রিপ্লেস করতে "delet" লিখে রিপ্লাই দিন।`, threadID, (err, info) => {
            global.GoatBot.onReply.set(info.messageID, { commandName: "install", author: senderID, name, sourceCode, messageID: info.messageID });
        }, messageID);
    }

    try {
        // ১০% এ আটকে যাওয়া রোধ করতে অ্যানিমেশন আরও দ্রুত করা হয়েছে
        const resMsg = await api.sendMessage("⏳ 𝗜𝗻𝘀𝘁𝗮𝗹𝗹𝗶𝗻𝗴... [ 𝟭𝟬% ]", threadID);
        
        await new Promise(r => setTimeout(r, 600));
        await api.editMessage("⏳ 𝗜𝗻𝘀𝘁𝗮𝗹𝗹𝗶𝗻𝗴... [ 𝟲𝟬% ]", resMsg.messageID).catch(() => {});
        
        await new Promise(r => setTimeout(r, 600));
        await api.editMessage("⏳ 𝗜𝗻𝘀𝘁𝗮𝗹𝗹𝗶𝗻𝗴... [ 𝟭𝟬𝟬% ]", resMsg.messageID).catch(() => {});

        await performInstallLogic(name, sourceCode);

        const successStyle = `╭─────────────╮
   📥 𝗜𝗡𝗦𝗧𝗔𝗟𝗟 𝗗𝗢𝗡𝗘 📥
╰─────────────╯
━━━━━━━━━━━━━━━
🚀 𝗦𝘁𝗮𝘁𝘂𝘀: সফলভাবে ইনস্টল হয়েছে!
📝 𝗡𝗮𝗺𝗲: 『 ${name.toUpperCas
