const axios = require("axios");

module.exports.config = {
  name: "owner",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Ariful Islam Sabbir",
  description: "Bot এর Owner এর তথ্য দেখাও",
  usePrefix: true,
  category: "Info",
  usages: "owner",
  cooldowns: 5
};

module.exports.onStart = async function ({ api, event, message }) {
  const ownerText =
    `╔══✨ OWNER INFO ✨══╗\n\n` +
    `👤 নাম: Md Ariful Islam Sabbir\n` +
    `📚 ক্লাস: 12+\n` +
    `☪️ ধর্ম: Islam\n` +
    `💔 সম্পর্ক: Single\n` +
    `👑 Role: Bot Admin & Developer\n\n` +
    `╠══════════════════════╣\n` +
    `  💖 Powered by Sabbir Chat Bot\n` +
    `╚══════════════════════╝`;

  try {
    const imgUrl = "https://i.imgur.com/jqEKJpB.jpeg";
    const response = await axios.get(imgUrl, { responseType: "stream" });

    await api.sendMessage(
      {
        body: ownerText,
        attachment: response.data
      },
      event.threadID,
      event.messageID
    );
  } catch (err) {
    return message.reply(ownerText);
  }
};
