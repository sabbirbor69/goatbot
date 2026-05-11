const moment = require("moment-timezone");

module.exports.config = {
  name: "time",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Ariful Islam Sabbir",
  description: "বর্তমান সময় ও তারিখ দেখাও",
  usePrefix: true,
  category: "Info",
  usages: "time",
  cooldowns: 3
};

module.exports.onStart = async function ({ message }) {
  const now = moment().tz("Asia/Dhaka");

  const date = now.format("DD MMMM YYYY");
  const time = now.format("hh:mm:ss A");
  const day = now.format("dddd");

  return message.reply(
    `🕐 বর্তমান সময়:\n\n` +
    `📅 তারিখ: ${date}\n` +
    `📆 বার: ${day}\n` +
    `⏰ সময়: ${time} (BD)`
  );
};
