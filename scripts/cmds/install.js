/install install.js module.exports.config = {
    name: "install",
    version: "6.0.0",
    role: 2,
    credits: "Ariful Islam Sabbir",
    description: "Fake Animation সহ একই মেসেজে কোড বা রিপ্লাই দিয়ে ইনস্টল করুন",
    usePrefix: true,
    category: "Admin",
    usages: "install <name> <code_here>",
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

// এটি আসল ইনস্টলেশন লজিক (কোডের লাস্টে থাকবে)
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
        throw new Error("Invalid Command Format!");
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
        const resMsg = await api.sendMessage("⏳ Updating... [ 𝟬% ]", event.threadID);
        const steps = ["𝟰𝟬%", "𝟴𝟬%", "𝟭𝟬𝟬%"];
        for (const step of steps) {
            await new Promise(r => setTimeout(r, 400));
            await api.editMessage(`⏳ Updating... [ ${step} ]`, resMsg.messageID);
        }
        await performInstallLogic(Reply.name, Reply.sourceCode);
        api.unsendMessage(Reply.messageID);
        api.sendMessage(`✅ Updated Successful: ${Reply.name}`, event.threadID);
    }
};

module.exports.onStart = async function ({ api, event, args }) {
    const { threadID, messageID, messageReply, senderID, attachments } = event;
    let sourceCode = "";
    let name = (args[0] || "").toLowerCase().replace(/.js$/i, "");

    if (args.length > 1) {
        sourceCode = event.body.slice(event.body.indexOf(args[1]));
    } 
    else if (messageReply) {
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
        return api.sendMessage(`⚠️ "${name}" অলরেডি আছে। আপডেট করতে "delet" লিখে রিপ্লাই দিন।`, threadID, (err, info) => {
            global.GoatBot.onReply.set(info.messageID, { commandName: "install", author: senderID, name, sourceCode, messageID: info.messageID });
        }, messageID);
    }

    try {
        // --- অ্যানিমেশন শুরু ---
        const resMsg = await api.sendMessage("⏳ 𝗜𝗻𝘀𝘁𝗮𝗹𝗹𝗶𝗻𝗴... [ 𝟭𝟬% ]", threadID);
        const steps = ["𝟯𝟬%", "𝟱𝟬%", "𝟳𝟬%", "𝟵𝟬%", "𝟭𝟬𝟬%"];
        
        for (const step of steps) {
            await new Promise(resolve => setTimeout(resolve, 500));
            await api.editMessage(`⏳ 𝗜𝗻𝘀𝘁𝗮𝗹𝗹𝗶𝗻𝗴... [ ${step} ]`, resMsg.messageID);
        }

        // আসল কাজ সম্পন্ন করা
        await performInstallLogic(name, sourceCode);

        // ফাইনাল স্টাইলিশ মেসেজ
