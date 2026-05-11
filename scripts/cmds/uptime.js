module.exports.config = {
  name: "uptime",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Ariful Islam Sabbir",
  description: "Bot কতক্ষণ ধরে চলছে দেখাও",
  usePrefix: true,
  category: "Info",
  usages: "uptime",
  cooldowns: 3
};

module.exports.onStart = async function ({ message, event }) {
  const start = Date.now();

  const totalSeconds = Math.floor(process.uptime());
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let uptime = "";
  if (days > 0) uptime += `${days}d `;
  if (hours > 0 || days > 0) uptime += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) uptime += `${minutes}m `;
  uptime += `${seconds}s`;

  const ping = Date.now() - start;

  const text =
    `╔══════════════════╗\n` +
    `   𝐆𝐎𝐀𝐓 𝐁𝐎𝐓 𝐒𝐘𝐒𝐓𝐄𝐌 \n` +
    `╚══════════════════╝\n` +
    `  │\n` +
    `  ├─ ᴜᴘᴛɪᴍᴇ: ${uptime} ⏳\n` +
    `  ├─ ʟᴀᴛᴇɴᴄʏ: ${ping}ᴍꜱ ⚡\n` +
    `  ├─ ᴘʟᴀᴛꜰᴏʀᴍ: ʟɪɴᴜx 🌐\n` +
    `  ├─ ᴠᴇʀsɪᴏɴ: ᴠ1.0.0 🤖\n` +
    `  ├─ ꜱᴛᴀᴛᴜস: ᴀᴄᴛɪᴠᴇ 🟢\n` +
    `  └─ ᴘʀɪᴠᴀᴄʏ: ꜱᴇᴄᴜʀᴇᴅ 🔒`;

  return message.reply(text);
};
