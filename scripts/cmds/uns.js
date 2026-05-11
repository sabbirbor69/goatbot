module.exports.config = {
  name: "uns",
  version: "1.0.0",
  role: 0,
  credits: "Ariful Islam Sabbir",
  description: "Bot এর message unsend করো — reply করে /uns দাও",
  usePrefix: true,
  category: "Utility",
  usages: "কোনো bot message এ reply করে /uns",
  cooldowns: 3
};

module.exports.onStart = async function ({ api, event }) {
  const { threadID, messageID, messageReply } = event;
  const botID = String(api.getCurrentUserID());

  if (!messageReply) {
    return api.sendMessage(
      "❌ কোনো message এ reply করোনি!\n\n📌 ব্যবহার:\n• Bot এর যে message টা unsend করতে চাও, সেটায় reply করে /uns লিখো",
      threadID,
      messageID
    );
  }

  const targetMsgID = messageReply.messageID;
  const targetSenderID = String(messageReply.senderID);

  if (targetSenderID !== botID) {
    return api.sendMessage(
      "❌ শুধুমাত্র Bot এর নিজের message unsend করা যাবে!",
      threadID,
      messageID
    );
  }

  try {
    await api.unsendMessage(targetMsgID);
    try {
      await api.unsendMessage(messageID);
    } catch (e) {}
  } catch (err) {
    return api.sendMessage(
      `❌ Message unsend করতে পারিনি!\n🐛 Error: ${err.message}`,
      threadID,
      messageID
    );
  }
};
