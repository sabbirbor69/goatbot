const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const DB_PATH = path.join(process.cwd(), "database", "teach.json");

function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) fs.writeJsonSync(DB_PATH, {});
    return fs.readJsonSync(DB_PATH);
  } catch (e) { return {}; }
}

function saveDB(data) {
  try { fs.writeJsonSync(DB_PATH, data, { spaces: 2 }); } catch (e) {}
}

function normalize(str) {
  return (str || "").toLowerCase().trim().replace(/\s+/g, " ");
}

const TEACH_URL = "https://sabbir-baby-api.onrender.com/api/teach";

module.exports.config = {
  name: "teach",
  version: "3.0.0",
  hasPermssion: 0,
  credits: "Ariful Islam Sabbir",
  description: "Bot কে প্রশ্ন-উত্তর শেখাও",
  usePrefix: true,
  category: "Chat",
  usages: "reply করে /teach <উত্তর> | /teach q <প্রশ্ন> a <উত্তর>",
  cooldowns: 3
};

module.exports.onStart = async function ({ api, event, message, args }) {
  const sub = (args[0] || "").toLowerCase();
  const { messageReply } = event;

  // Format 1: reply করে /teach <উত্তর> → সরাসরি শেখাও
  if (messageReply && messageReply.body && sub !== "list" && sub !== "del" && sub !== "q") {
    const question = messageReply.body.trim();
    const answer = args.join(" ").trim();

    if (!answer) {
      return message.reply(
        "❌ উত্তর লিখোনি!\n\n" +
        "📌 নিয়ম:\n" +
        "   যে message এ reply করলে সেটা হবে প্রশ্ন\n" +
        "   /teach এর পরে লেখা হবে উত্তর\n\n" +
        "✅ যেমন: (কারো message এ reply করে)\n" +
        "   /teach আমি SABBIR BOT"
      );
    }

    if (!question) return message.reply("❌ Reply করা message এ text নেই!");

    const db = loadDB();
    const existingKey = Object.keys(db).find(k => normalize(k) === normalize(question));
    db[existingKey || question] = answer;
    saveDB(db);

    try {
      await axios.post(TEACH_URL, { question, answer }, {
        headers: { "Content-Type": "application/json" },
        timeout: 8000
      });
    } catch (e) {}

    return message.reply(
      `✅ শেখানো হয়েছে!\n\n❓ প্রশ্ন: ${question}\n✅ উত্তর: ${answer}`
    );
  }

  // Format 4: /teach q <প্রশ্ন> a <উত্তর>
  if (sub === "q") {
    const restArgs = args.slice(1);
    const aIdx = restArgs.indexOf("a");
    if (aIdx === -1 || aIdx === 0) {
      return message.reply(
        "❌ ভুল format!\n\n" +
        "সঠিক নিয়ম:\n" +
        "/teach q <প্রশ্ন> a <উত্তর>\n" +
        "যেমন: /teach q তুমি কে a আমি SABBIR BOT"
      );
    }
    const question = restArgs.slice(0, aIdx).join(" ").trim();
    const answer = restArgs.slice(aIdx + 1).join(" ").trim();
    if (!question) return message.reply("❌ প্রশ্ন লিখোনি!");
    if (!answer) return message.reply("❌ উত্তর লিখোনি!");

    const db = loadDB();
    const existingKey = Object.keys(db).find(k => normalize(k) === normalize(question));
    db[existingKey || question] = answer;
    saveDB(db);

    try {
      await axios.post(TEACH_URL, { question, answer }, {
        headers: { "Content-Type": "application/json" },
        timeout: 8000
      });
    } catch (e) {}

    return message.reply(
      `✅ শেখানো হয়েছে!\n\n❓ প্রশ্ন: ${question}\n✅ উত্তর: ${answer}`
    );
  }

  // Help message
  return message.reply(
    "📚 কীভাবে শেখাবে:\n\n" +
    "1️⃣ সহজ উপায় — কারো message এ reply করে:\n" +
    "   /teach <উত্তর>\n" +
    "   (reply করা message = প্রশ্ন, তোমার লেখা = উত্তর)\n\n" +
    "2️⃣ সরাসরি:\n" +
    "   /teach q <প্রশ্ন> a <উত্তর>\n\n" +
    "" +
    "🗑️ মুছতে:বস সাব্বির কে মেসেজ দিন"
  );
};

module.exports.onChat = async function ({ api, event, message }) {
  const body = (event.body || "").trim();
  if (!body || body.startsWith("/")) return;

  const db = loadDB();
  const normBody = normalize(body);
  const key = Object.keys(db).find(k => normalize(k) === normBody);
  if (!key) return;

  try {
    await message.reply(db[key]);
  } catch (e) {}
};
