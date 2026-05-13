const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI("YOUR_GEMINI_API_KEY");

const FALLBACK_REPLIES = [
  "হুমম...",
  "বলো 🙂",
  "আচ্ছা...",
  "হ্যাঁ বলো",
  "ঠিক আছে 😹"
];

function getFallback() {
  return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
}

module.exports.config = {
  name: "autoreplybot",
  version: "8.0.0",
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
    "hi": "হেই 😹",
    "bot": "বলো জান 🙂",
    "bby": "ki oise bby🥹",
    "assalamualaikum": "Walaikumassalam ❤️",
    "assalamu alaikum": "Walaikumassalam ❤️"
  };

  if (quickResponses[msg]) {
    return message.reply(quickResponses[msg]);
  }

  if (
    type !== "message_reply" ||
    !messageReply ||
    messageReply.senderID !== botID
  ) return;

  try {

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `
You are a funny Bangladeshi Facebook friend.
Reply in casual Banglish.
Use slang and emoji sometimes.
Keep replies short and fun.
`
    });

    const result = await model.generateContent(body);

    let botReply = result.response.text();

    if (!botReply) {
      botReply = getFallback();
    }

    const cleanReply = botReply
      .replace(/([\\u2700-\\u27BF]|[\\uE000-\\uF8FF]|\\uD83C[\\uDC00-\\uDFFF]|\\uD83D[\\uDC00-\\uDFFF]|[\\u2011-\\u26FF]|\\uD83E[\\uDD10-\\uDDFF])/g, '')
      .trim();

    message.reply(cleanReply || getFallback());

  } catch (err) {

    console.log("Reply Error: " + err.message);

    message.reply(getFallback());
  }
};

module.exports.onStart = async function ({ message, args }) {

  const input = args.join(" ");

  if (!input) return message.reply("বলো 🙂");

  try {

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `
You are a funny Bangladeshi Facebook friend.
Reply in casual Banglish.
Use slang and emoji sometimes.
Keep replies short and fun.
`
    });

    const result = await model.generateContent(input);

    const reply = result.response.text();

    const cleanReply = (reply || "")
      .replace(/([\\u2700-\\u27BF]|[\\uE000-\\uF8FF]|\\uD83C[\\uDC00-\\uDFFF]|\\uD83D[\\uDC00-\\uDFFF]|[\\u2011-\\u26FF]|\\uD83E[\\uDD10-\\uDDFF])/g, '')
      .trim();

    message.reply(cleanReply || getFallback());

  } catch (e) {

    console.log(e);

    message.reply("API down 😿");
  }
};
