const SABBIR = "Ariful Islam Sabbir";
const reactions = [
  "❤️", "😆", "😮", "😢", "😠", "👍", "🎉", "🔥", "💯", "😍", "🥰", "😂", "👏", "💪", "🙌", "✨", "🚀", "🌈", "⭐", "🎈",
  "😎", "🤩", "🤔", "🧐", "🙄", "😏", "🥳", "😭", "😤", "🤯", "😴", "😇", "🥳", "😜", "🤑", "😲", "🤐", "😴", "🤤", "😵",
  "🤠", "👽", "👾", "🤖", "🎃", "😺", "😸", "😻", "😽", "🤘", "🤝", "✌️", "🤞", "🤙", "🖐️", "👊", "💥", "💢", "💎", "👑",
  "🌻", "🌹", "🍀", "🍎", "🍕", "🍔", "🍦", "🍩", "🌍", "🌕", "☀️", "⛈️", "⚡", "🔥", "💧", "🌊", "🏀", "⚽", "🎮", "🎸",
  "📱", "💻", "💡", "💰", "✉️", "🎁", "🚩", "🏁", "✅", "❌", "🌀", "🧿", "🎵", "🎶", "🔔", "📣", "💬", "💭", "🉐", "㊙️",
  "㊗️", "🔞", "📍"
];

if (!global.autoReactThreads) global.autoReactThreads = new Set();

module.exports.config = {
  name: "autoreact",
  version: "1.2.0",
  role: 1,
  credits: "Ariful Islam Sabbir",
  usePrefix: true,
  category: "System",
  countDown: 3,
  shortDescription: "প্রতিটা message এ auto react করে",
  longDescription: "বট এডমিন শুধু এই কমান্ডটি অন/অফ করতে পারবে",
  guide: {
    en: "{pn} on/off",
    bn: "{pn} on/off"
  }
};

module.exports.onLoad = async function ({ threadsData }) {
  try {
    const all = global.db.allThreadData || [];
    for (const t of all) {
      if (t.data?.autoReact === true) {
        global.autoReactThreads.add(t.threadID);
      }
    }
  } catch (e) {}
};

module.exports.onStart = async function ({ event, args, message, threadsData }) {
  const { threadID } = event;
  const action = (args[0] || "").toLowerCase();

  if (!["on", "off"].includes(action)) {
    const status = global.autoReactThreads.has(threadID) ? "✅ চালু" : "❌ বন্ধ";
    return message.reply(
      `🎭 AutoReact Status: ${status}\n\n📌 ব্যবহার:\n• /autoreact on → চালু করো\n• /autoreact off → বন্ধ করো`
    );
  }

  const isEnable = action === "on";

  if (isEnable) {
    global.autoReactThreads.add(threadID);
  } else {
    global.autoReactThreads.delete(threadID);
  }

  try {
    await threadsData.set(threadID, "autoReact", isEnable);
  } catch (e) {}

  return message.reply(
    isEnable
      ? `✅ AutoReact চালু হয়েছে!\nএখন সবার message এ random react পড়বে।`
      : `❌ AutoReact বন্ধ হয়েছে!`
  );
};

module.exports.onChat = async function ({ api, event }) {
  const { threadID, messageID, senderID, body } = event;

  if (!body) return;
  if (senderID == api.getCurrentUserID()) return;
  if (body.startsWith(global.GoatBot.config.prefix)) return;
  if (!global.autoReactThreads.has(threadID)) return;

  const randomReact = reactions[Math.floor(Math.random() * reactions.length)];

  setTimeout(() => {
    api.setMessageReaction(randomReact, messageID, (err) => {
      if (err) console.error("[AutoReact] Reaction Error:", err);
    }, true);
  }, 500);
};
