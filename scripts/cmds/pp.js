const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "pp",
  version: "1.1.0",
  role: 0,
  credits: "Ariful Islam Sabbir",
  description: "কোনো মেসেজ ছাড়া সরাসরি প্রোফাইল পিকচার দেখাবে",
  usePrefix: true,
  category: "Info",
  usages: "pp [@mention | reply]",
  cooldowns: 2
};

async function resolveTarget(api, event) {
  const { mentions, senderID, messageReply, threadID, body } = event;
  const mentionIDs = mentions && typeof mentions === "object"
    ? Object.keys(mentions).filter(id => id && id !== "null" && id !== senderID)
    : [];

  if (mentionIDs.length > 0) return { uid: mentionIDs[0] };
  if (messageReply) return { uid: messageReply.senderID };

  const args = (body || "").trim().split(/\s+/);
  const nameQuery = args.slice(1).join(" ").replace(/^@/, "").toLowerCase().trim();

  if (nameQuery) {
    try {
      const threadInfo = await api.getThreadInfo(threadID);
      const matched = (threadInfo.userInfo || []).find(p =>
        p.name && p.name.toLowerCase().includes(nameQuery)
      );
      if (matched) return { uid: matched.id };
    } catch (e) {}
  }
  return { uid: senderID };
}

module.exports.onStart = async function ({ api, message, event }) {
  const { uid: targetID } = await resolveTarget(api, event);

  try {
    const avatarURL = `https://graph.facebook.com/${targetID}/picture?width=1024&height=1024&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;

    const res = await axios.get(avatarURL, { responseType: "arraybuffer" });
    const tmpPath = path.join(__dirname, `../../tmp/pp_${targetID}.jpg`);
    await fs.outputFile(tmpPath, res.data);

    // শুধু অ্যাটাচমেন্ট পাঠানো হচ্ছে, বডি খালি রাখা হয়েছে
    await message.reply({
      attachment: fs.createReadStream(tmpPath)
    });

    await fs.remove(tmpPath);
  } catch (err) {
    // এরর হলেও ছোট করে জানানো ভালো, তবে আপনি চাইলে এটিও সরিয়ে দিতে পারেন
    console.error(err);
  }
};
