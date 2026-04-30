"use strict";

const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "autoseen",
  version: "8.1.1",
  role: 2,
  credits: "Ariful Islam Sabbir",
  description: "config.json থেকে auto-seen নিয়ন্ত্রণ করে",
  usePrefix: true,
  category: "System",
  guide: {
    bn: "{pn} on | off | status"
  }
};

const configPath = path.join(__dirname, "..", "..", "config.json");

function getAutoSeenConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config.autoseen !== undefined ? config.autoseen : true;
  } catch (_) {
    return true;
  }
}

function setAutoSeenConfig(status) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.autoseen = status;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (_) {
    return false;
  }
}

async function sabbirMarkSeen(api, threadID, messageID) {
  if (!api || !threadID) return;
  if (typeof api.markAsRead === "function") {
    try { await api.markAsRead(threadID, true); } catch (_) {}
  }
  if (typeof api.markAsReadAll === "function") {
    try { await api.markAsReadAll(); } catch (_) {}
  }
  if (messageID && typeof api.markAsDelivered === "function") {
    try { await api.markAsDelivered(threadID, messageID); } catch (_) {}
  }
}

module.exports.onStart = async function ({ message, args }) {
  const sub = (args[0] || "status").toLowerCase();

  if (sub === "on" || sub === "enable") {
    const ok = setAutoSeenConfig(true);
    return message.reply(ok ? "✅ Auto-seen चालू করা হয়েছে (config.json এ সেভ হয়েছে)।" : "❌ সেটিংস আপডেট করতে পারিনি।");
  }
  if (sub === "off" || sub === "disable") {
    const ok = setAutoSeenConfig(false);
    return message.reply(ok ? "⛔ Auto-seen বন্ধ করা হয়েছে।" : "❌ সেটিংস আপডেট করতে পারিনি।");
  }
  
  const status = getAutoSeenConfig();
  return message.reply(`📖 Auto-seen status: ${status ? "✅ ON" : "⛔ OFF"}`);
};

module.exports.onAnyEvent = async function ({ api, event }) {
  const isEnabled = getAutoSeenConfig();
  if (!isEnabled) return;
  if (!event || !event.threadID) return;

  const ignoreTypes = new Set(["typ", "presence"]);
  if (ignoreTypes.has(event.type)) return;

  const messageID = event.messageID || null;
  sabbirMarkSeen(api, event.threadID, messageID).catch(() => {});
};
