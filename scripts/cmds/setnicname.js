module.exports.config = {
  name: "setnicname",
  version: "1.0.0",
  role: 0,
  credits: "Ariful Islam Sabbir",
  description: "Group এ কারো nickname সেট করো",
  usePrefix: true,
  category: "Group",
  usages: "setnicname [nickname] — reply করে অথবা mention দিয়ে",
  cooldowns: 5
};

module.exports.onStart = async function ({ api, event }) {
  const { threadID, messageID, messageReply, mentions, body, senderID } = event;

  const args = (body || "").trim().split(/\s+/);
  args.shift();

  const mentionIDs = Object.keys(mentions || {});

  let targetID = null;
  let nickname = "";

  if (mentionIDs.length > 0) {
    targetID = mentionIDs[0];
    const mentionTag = mentions[targetID] || "";
    const bodyAfterCmd = (body || "").replace(/^\/setnicname\s*/i, "");
    nickname = bodyAfterCmd.replace(mentionTag, "").trim();
  } else if (messageReply) {
    targetID = String(messageReply.senderID);
    nickname = args.join(" ").trim();
  } else {
    targetID = String(senderID);
    nickname = args.join(" ").trim();
  }

  if (!nickname) {
    return api.sendMessage(
      "❌ Nickname দাওনি!\n\n📌 ব্যবহার:\n• কারো message এ reply করে: /setnicname নতুন নাম\n• Mention করে: /setnicname @ব্যক্তি নতুন নাম\n• নিজের: /setnicname নতুন নাম\n• Nickname মুছতে: /setnicname reset",
      threadID,
      messageID
    );
  }

  const finalNickname = nickname.toLowerCase() === "reset" ? "" : nickname;

  try {
    await api.changeNickname(finalNickname, threadID, targetID);

    let targetName = "User";
    try {
      const info = await api.getUserInfo([targetID]);
      if (info && info[targetID]) targetName = info[targetID].name || "User";
    } catch (e) {}

    if (finalNickname === "") {
      return api.sendMessage(
        `✅ ${targetName} এর nickname মুছে ফেলা হয়েছে!`,
        threadID,
        messageID
      );
    }

    return api.sendMessage(
      `✅ ${targetName} এর nickname সেট করা হয়েছে!\n📛 নতুন নাম: ${finalNickname}`,
      threadID,
      messageID
    );
  } catch (err) {
    return api.sendMessage(
      `❌ Nickname সেট করতে পারিনি!\n🐛 Error: ${err.message}`,
      threadID,
      messageID
    );
  }
};
