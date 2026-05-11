const { getName } = require("../../utils/getName.js");

module.exports.config = {
  name: "welcome",
  version: "1.1.0",
  role: 0,
  credits: "Ariful Islam Sabbir",
  description: "Group এ কেউ join করলে welcome message পাঠায়",
  category: "Events",
  countDown: 0
};

module.exports.onStart = async function ({ api, event }) {
  if (event.logMessageType !== "log:subscribe") return;

  const { threadID, logMessageData } = event;

  const addedIDs = logMessageData?.addedParticipants || [];
  if (addedIDs.length === 0) return;

  const botID = String(api.getCurrentUserID());

  for (const added of addedIDs) {
    const userID = String(added.userFbId || added.id || "").replace(/^fbid:/, "");
    if (!userID || userID === botID) continue;

    let name = added.fullName || added.name || "";
    if (!name || name === "Facebook User") {
      name = await getName(api, userID, "বন্ধু");
    }

    let memberCount = "?";
    try {
      const info = await api.getThreadInfo(threadID);
      memberCount = (info.participantIDs || []).length;
    } catch (e) {}

    const welcomeMsg =
      `🎉 স্বাগতম, ${name}! 🎉\n\n` +
      `👋 তুমি এই group এ ${memberCount} তম member হিসেবে যোগ দিয়েছো!\n\n` +
      `📌 Group এর rules মেনে চলো এবং সবার সাথে ভালো ব্যবহার করো।\n` +
      `🤖 Bot এর commands দেখতে /help লিখো।\n\n` +
      `🌟 তোমাকে পেয়ে আমরা খুশি! 💙`;

    try {
      await api.sendMessage(
        {
          body: welcomeMsg,
          mentions: [{ tag: name, id: userID, fromIndex: welcomeMsg.indexOf(name), length: name.length }]
        },
        threadID
      );
    } catch (e) {
      try { await api.sendMessage(welcomeMsg, threadID); } catch (_) {}
    }
  }
};
