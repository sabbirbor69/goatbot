const axios = require("axios");

module.exports.config = {
  name: "imgur",
  version: "1.0.0",
  role: 0,
  credits: "Sabbir (modified)",
  description: "ছবিতে রিপ্লাই দিয়ে ইমগুর লিঙ্ক তৈরি করুন",
  usePrefix: true,
  category: "tools",
  usages: "ছবিতে রিপ্লাই দিন",
  cooldowns: 5
};

module.exports.onStart = async function ({ api, event }) {
  try {
    const { messageReply, threadID, messageID } = event;

    if (!messageReply || !messageReply.attachments || messageReply.attachments.length === 0) {
      return api.sendMessage("⚠️ অনুগ্রহ করে কোনো ছবিতে reply দিন।", threadID, messageID);
    }

    const imageUrl = messageReply.attachments[0].url;

    const res = await axios.post(
      "https://api.imgur.com/3/image",
      {
        image: imageUrl,
        type: "url",
      },
      {
        headers: {
          Authorization: "Client-ID 546c25a59c58ad7", // এটি একটি ডেমো আইডি
        },
      }
    );

    const link = res.data.data.link;
    return api.sendMessage(`✅ Imgur Upload Complete!\n\n🔗 ${link}`, threadID, messageID);

  } catch (err) {
    console.error(err);
    return api.sendMessage("❌ Upload failed!", event.threadID, event.messageID);
  }
};
