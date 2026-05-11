const { getName } = require("../../utils/getName.js");

module.exports.config = {
  name: "autoadd",
  version: "1.1.0",
  role: 1,
  credits: "Ariful Islam Sabbir",
  usePrefix: true,
  hidden: false,
  category: "group",
  countDown: 3,
  shortDescription: "কেউ leave করলে bot auto add করবে",
  longDescription: "Group admin এই command দিয়ে autoadd on/off করতে পারবে",
  guide: {
    en: "{pn} on/off",
    bn: "{pn} on/off"
  }
};

if (!global.autoAddEnabled) global.autoAddEnabled = new Map();

module.exports.onStart = async function ({ api, event, args, message, threadsData }) {
  const { threadID } = event;
  const sub = (args[0] || "").toLowerCase();

  if (!sub || !["on", "off"].includes(sub)) {
    const status = global.autoAddEnabled.get(threadID) ? "✅ চালু" : "❌ বন্ধ";
    return message.reply(
      `🔄 AutoAdd Status: ${status}\n\n` +
      `📌 ব্যবহার:\n` +
      `• /autoadd on → চালু করো\n` +
      `• /autoadd off → বন্ধ করো\n\n` +
      `ℹ️ চালু থাকলে কেউ leave করলে bot তাকে auto add করবে।`
    );
  }

  const isEnable = sub === "on";
  global.autoAddEnabled.set(threadID, isEnable);

  try { await threadsData.set(threadID, "autoAdd", isEnable); } catch (e) {}

  return message.reply(
    isEnable
      ? `✅ AutoAdd চালু হয়েছে!\n🔄 এখন কেউ leave করলে bot তাকে আবার add করবে।`
      : `❌ AutoAdd বন্ধ হয়েছে!`
  );
};

module.exports.onLoad = async function () {
  try {
    const allThreads = (global.db && global.db.allThreadData) || [];
    for (const thread of allThreads) {
      const status = thread?.data?.autoAdd;
      if (status === true) {
        global.autoAddEnabled.set(thread.threadID, true);
      }
    }
  } catch (e) {}
};

module.exports.onEvent = async function ({ api, event }) {
  try {
    const { threadID, logMessageType, logMessageData, author } = event;
    if (logMessageType !== "log:unsubscribe") return;

    const isEnabled = global.autoAddEnabled.get(threadID);
    if (!isEnabled) return;

    const leftUserID = String(
      logMessageData?.leftParticipantFbId ||
      logMessageData?.removedParticipantFbId ||
      event.userID ||
      author ||
      ""
    );

    if (!leftUserID) return;

    const botID = String(api.getCurrentUserID());
    if (leftUserID === botID) return;

    setTimeout(async () => {
      const userName = await getName(api, leftUserID, "User");
      try {
        await api.addUserToGroup([leftUserID], threadID);
        await api.sendMessage(
          `🔄 ${userName} leave করেছিল, bot আবার add করেছে! 😈`,
          threadID
        );
      } catch (err) {
        console.error("autoadd failed:", err);
        await api.sendMessage(
          `⚠️ ${userName} কে auto-add করা যায়নি।\n${err.message || err.error || ""}`,
          threadID
        ).catch(() => {});
      }
    }, 2000);

  } catch (e) {
    console.error("autoadd onEvent error:", e);
  }
};
