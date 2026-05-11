module.exports.config = {
  name: "restart",
  version: "2.0.0",
  role: 2,
  credits: "Ariful Islam Sabbir",
  description: "Bot restart করো — বিস্তারিত status দেখিয়ে restart",
  usePrefix: true,
  category: "Admin",
  usages: "restart",
  cooldowns: 10
};

function fmtUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function fmtMem(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function mqttStatus() {
  try {
    const client = global.mqttClient || global.Fca?.Data?.mqttClient;
    if (!client) return "❓ Unknown";
    if (client.connected) return "✅ Connected";
    if (client.reconnecting) return "🔄 Reconnecting";
    return "❌ Disconnected";
  } catch (_) { return "❓ Unknown"; }
}

module.exports.onStart = async function ({ api, event, message }) {
  const { senderID, threadID, messageID } = event;
  const adminList = (global.GoatBot?.config?.adminBot || global.GoatBot?.config?.adminID || []).map(String);

  if (!adminList.includes(String(senderID))) {
    return message.reply("⛔ শুধুমাত্র Bot Admin এই command ব্যবহার করতে পারবে।");
  }

  const mem = process.memoryUsage();
  const uptimeSec = process.uptime();
  const cmdCount = global.GoatBot?.commands?.size || 0;
  const evtCount = global.GoatBot?.eventCommands?.size || 0;
  const threadCount = global.db?.allThreadData?.length || 0;
  const userCount = global.db?.allUserData?.length || 0;
  const prefix = global.GoatBot?.config?.prefix || "/";

  const lines = [
    "╔══ 🔄 BOT RESTARTING ══╗",
    `│ ⏱ Uptime   : ${fmtUptime(uptimeSec)}`,
    `│ 🧠 Memory   : ${fmtMem(mem.heapUsed)} / ${fmtMem(mem.heapTotal)}`,
    `│ 📦 Commands : ${cmdCount}  │  🎉 Events: ${evtCount}`,
    `│ 💬 Threads  : ${threadCount}  │  👥 Users: ${userCount}`,
    `│ 🔑 Prefix   : ${prefix}`,
    `│ 📡 MQTT     : ${mqttStatus()}`,
    "│",
    "│ ⚡ Bot 10-15 সেকেন্ডের মধ্যে",
    "│    আবার online হয়ে যাবে।",
    "╚══════════════════════╝"
  ];

  await message.reply(lines.join("\n"));

  setTimeout(() => process.exit(2), 2000);
};
