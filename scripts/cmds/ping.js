const { loadingBar } = require("../../utils/animation.js");

module.exports.config = {
  name: "ping",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Ariful Islam Sabbir",
  description: "Bot এর response time দেখাও",
  usePrefix: true,
  category: "Info",
  usages: "ping",
  cooldowns: 3
};

module.exports.onStart = async function ({ api, event, message }) {
  await loadingBar(api, event.threadID, event.messageID);


  const start = Date.now();
  await message.reply("🏓 Pinging...");
  const ping = Date.now() - start;
  return message.reply(`🏓 Pong!\n⚡ Response: ${ping}ms`);
};
