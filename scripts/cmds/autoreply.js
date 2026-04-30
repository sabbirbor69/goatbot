const SABBIR = "Ariful Islam Sabbir";
const axios = require("axios");

const CYBERBOT_API = "https://simsimi.cyberbot.top";

const FALLBACK_REPLIES = [
  "হুমম...",
  "বলো 🙂",
  "আচ্ছা...",
  "হ্যাঁ বলো",
  "ঠিক আছে"
];

function getFallback() {
  return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
}

async function getSimsimiReply(text) {
  const res = await axios.get(`${CYBERBOT_API}/simsimi?text=${encodeURIComponent(text)}`, { timeout: 8000 });
  const reply = res.data.text || res.data.response || res.data.answer || res.data.message;
  return reply ? reply.trim() : null;
}

module.exports.config = {
  name: "autoreplybot",
  version: "7.0.0",
  hasPermssion: 0,
  credits: "Ariful Islam Sabbir",
  hidden: true,
  usePrefix: false,
  category: "Chat",
  cooldowns: 1
};

module.exports.onChat = async function ({ message, event, api }) {
  const { body, senderID, type, messageReply } = event;
  const botID = api.getCurrentUserID();

  if (!body || senderID == botID) return;
  const prefix = global.GoatBot?.config?.prefix || "/";
  if (body.startsWith(prefix) || body.startsWith("!")) return;

  const msg = body.toLowerCase().trim();

  const quickResponses = {
    "hi": "হেই",
    "hello": "বলো জান",
    "bby": "ki oise bby🥹",
    "assalamualaikum": "Walaikumassalam",
    "assalamu alaikum": "Walaikumassalam"
  };

  if (quickResponses[msg]) return message.reply(quickResponses[msg]);

  if (type !== "message_reply" || !messageReply || messageReply.senderID !== botID) return;

  try {
    let botReply = await getSimsimiReply(body);

    if (!botReply || botReply.toLowerCase().includes("i don't know") || botReply.toLowerCase().includes("don't understand")) {
      botReply = getFallback();
    }

    const cleanReply = botReply.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();

    message.reply(cleanReply || getFallback());

  } catch (err) {
    console.log("Reply Error: " + err.message);
    message.reply(getFallback());
  }
};

module.exports.onStart = async function ({ message, args }) {
  const input = args.join(" ");
  if (!input) return message.reply("বলো...");
  try {
    const reply = await getSimsimiReply(input);
    const cleanReply = (reply || "").replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
    message.reply(cleanReply || "হুমম...");
  } catch (e) {
    message.reply("সার্ভার ডাউন, পরে চেষ্টা করো।");
  }
};
