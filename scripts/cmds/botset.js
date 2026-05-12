const { loadingBar } = require("../../utils/animation.js");

module.exports = {
  config: {
    name: "botset",
    version: "6.0.0",
    author: "Ariful Islam Sabbir",
    countDown: 5,
    role: 2,
    description: "Animated Bot PP & Bio Updater",
    category: "Admin",
    guide: "{pn} [pp | bio]"
  },

  onStart: async function ({ api, event, args, message }) {

    const { type, messageReply, senderID, threadID, messageID } = event;

    if (!global.GoatBot.config.adminBot.includes(senderID)) {
      return message.reply("⚠️ Access Denied.");
    }

    await loadingBar(api, threadID, messageID);

    const action = args[0]?.toLowerCase();

    if (action === "pp") {

      if (
        type !== "message_reply" ||
        !messageReply.attachments ||
        messageReply.attachments[0]?.type !== "photo"
      ) {
        return message.reply(
          "❌ Please reply to a photo with:\n/botset pp"
        );
      }

      const imgUrl = messageReply.attachments[0].url;

      try {
        if (typeof api.changeAvt === "function") {
          await api.changeAvt(imgUrl);
          return api.sendMessage("✅ Profile picture updated!", threadID);
        } else {
          return api.sendMessage("❌ api.changeAvt not found in FCA.", threadID);
        }
      } catch (err) {
        return api.sendMessage(`❌ PP Update Failed:\n${err.message}`, threadID);
      }
    }

    else if (action === "bio") {

      const newBio = args.slice(1).join(" ");

      if (!newBio) {
        return message.reply("❌ Usage:\n/botset bio Your Bio");
      }

      try {
        if (typeof api.changeBio === "function") {
          await api.changeBio(newBio);
          return api.sendMessage("✅ Bio updated!", threadID);
        } else {
          return api.sendMessage("❌ api.changeBio not found in FCA.", threadID);
        }
      } catch (err) {
        return api.sendMessage(`❌ Bio Update Failed:\n${err.message}`, threadID);
      }
    }

    else {
      return message.reply(
`╔════════════════════╗
║     🤖 BOTSET      ║
╚════════════════════╝

1️⃣ Reply Photo:
→ /botset pp

2️⃣ Change Bio:
→ /botset bio Your Text
`
      );
    }
  }
};
