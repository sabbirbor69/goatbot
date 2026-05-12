const { loadingBar } = require("../../utils/animation.js");

module.exports.config = {
    name: "install",
    version: "5.0.0",
    role: 2,
    credits: "Ariful Islam Sabbir",
    description: "একই মেসেজে কোড বা রিপ্লাই দিয়ে ইনস্টল করুন",
    usePrefix: true,
    category: "Admin",
    usages: "install <name> <code_here> (বা কোড রিপ্লাই দিন)",
    cooldowns: 5,
};

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const TTL_MS = 5 * 60 * 1000; 
const CACHE_DIR = path.join(process.cwd(), "tmp", "install_cache", "cmds");

global.GoatBot = global.GoatBot || {};
global.GoatBot.tempInstalls = global.GoatBot.tempInstalls || new Map();

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
        throw new Error("❌ ইনভ্যালিড ফরম্যাট! config বা onStart নেই।");
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mod.__tempInstallId = id;
    mod.location = filePath;
    global.GoatBot.commands.set(name, mod);
    
    const timeoutHandle = setTimeout(() => cleanupTempInstall(name), TTL_MS);
    global.GoatBot.tempInstalls.set(name, { id, filePath, timeoutHandle });

    return api.sendMessage(`✅ ইনস্টল সফল!\n📌 নাম: ${name}\n⏳ স্থায়িত্ব: 5 মিনিট`, threadID, messageID);
}

module.exports.onReply = async function ({ api, event, Reply }) {
    if (event.senderID !== Reply.author) return;
    if (event.body.toLowerCase() === "delet") {
        await performInstall(Reply.name, Reply.sourceCode, api, event.threadID, event.messageID);
        api.unsendMessage(Reply.messageID);
    }
};

module.exports.onStart = async function ({ api, event, args }) {
  await loadingBar(api, event.threadID, event.messageID);


    const { threadID, messageID, messageReply, senderID, attachments } = event;
    let sourceCode = "";
    let name = (args[0] || "").toLowerCase().replace(/.js$/i, "");

    // ১. একই মেসেজে কোড থাকলে তা আলাদা করা
    if (args.length > 1) {
        sourceCode = event.body.slice(event.body.indexOf(args[1]));
    } 
    // ২. যদি একই মেসেজে কোড না থাকে, তবে রিপ্লাই চেক করা
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

    if (!sourceCode || sourceCode.length < 10) {
        return api.sendMessage("❌ কোড খুঁজে পাওয়া যায়নি!", threadID, messageID);
    }

    if (!name) return api.sendMessage("❌ নাম দিন: /install <name>", threadID, messageID);

    if (global.GoatBot.commands.has(name) && !global.GoatBot.tempInstalls.has(name)) {
        return api.sendMessage(`⚠️ "${name}" পার্মানেন্ট কমান্ড। রিপ্লেস করতে "delet" লিখুন।`, threadID, (err, info) => {
            global.GoatBot.onReply.set(info.messageID, { commandName: "install", author: senderID, name, sourceCode, messageID: info.messageID });
        }, messageID);
    }

    try {
        await performInstall(name, sourceCode, api, threadID, messageID);
    } catch (err) {
        api.sendMessage(err.message, threadID, messageID);
    }
};
