const { getName } = require("../../utils/getName.js");

module.exports.config = {
  name: "leav",
  version: "1.1.0",
  role: 0,
  credits: "Ariful Islam Sabbir",
  description: "Group থেকে কেউ leave করলে বিদায় message পাঠায়",
  category: "Events",
  countDown: 0
};

module.exports.onStart = async function ({ api, event }) {
  if (event.logMessageType !== "log:unsubscribe") return;

  const { threadID, logMessageData, author } = event;

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

  if (global.recentKicks) {
    const key = `${threadID}_${leftUserID}`;
    const ts = global.recentKicks.get(key);
    if (ts && Date.now() - ts < 30000) {
      global.recentKicks.delete(key);
      return;
    }
  }

  const wasKicked = String(author) && String(author) !== leftUserID;
  if (wasKicked) return;

  const leftName = await getName(api, leftUserID, "একজন member");
  const leaveMsg =
    `😢 ${leftName} group ছেড়ে চলে গেছে!\n` +
    `👋 আবার দেখা হবে...`;

  try {
    await api.sendMessage(leaveMsg, threadID);
  } catch (e) {}
};
