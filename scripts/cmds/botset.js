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

    const { type, messageReply, senderID, threadID } = event;

    // Admin Check
    if (!global.GoatBot.config.adminBot.includes(senderID)) {
      return message.reply("⚠️ Access Denied.");
    }

    const action = args[0]?.toLowerCase();

    // Sleep Function
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Animation Function
    async function animate(messageID, frames, delay = 1000) {
      for (const frame of frames) {
        await sleep(delay);

        try {
          await api.editMessage(messageID, frame);
        } catch (e) {
          console.log(e);
        }
      }
    }

    // =========================
    // PROFILE PICTURE UPDATE
    // =========================

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

      const start = await api.sendMessage(
`╔════════════════════╗
║   🖼️ UPDATE BOT PP  ║
╚════════════════════╝

⏳ Starting Update...
`,
        threadID
      );

      const frames = [

`╔════════════════════╗
║   🖼️ UPDATE BOT PP  ║
╚════════════════════╝

░░░░░░░░░░ 0%

📥 Downloading Image...
`,

`╔════════════════════╗
║   🖼️ UPDATE BOT PP  ║
╚════════════════════╝

███░░░░░░░ 25%

🧠 Processing Image...
`,

`╔════════════════════╗
║   🖼️ UPDATE BOT PP  ║
╚════════════════════╝

██████░░░░ 50%

📡 Connecting Facebook...
`,

`╔════════════════════╗
║   🖼️ UPDATE BOT PP  ║
╚════════════════════╝

████████░░ 75%

⚙️ Updating Profile...
`,

`╔════════════════════╗
║   🖼️ UPDATE BOT PP  ║
╚════════════════════╝

██████████ 100%

✅ PROFILE UPDATED
🤖 SABBIR CHAT BOT
`
      ];

      animate(start.messageID, frames, 800);

      try {

        if (typeof api.changeAvt === "function") {

          await sleep(3500);

          await api.changeAvt(imgUrl);

        } else {
          return api.sendMessage(
            "❌ api.changeAvt not found in FCA.",
            threadID
          );
        }

      } catch (err) {
        return api.sendMessage(
          `❌ PP Update Failed:\n${err.message}`,
          threadID
        );
      }
    }

    // =========================
    // BIO UPDATE
    // =========================

    else if (action === "bio") {

      const newBio = args.slice(1).join(" ");

      if (!newBio) {
        return message.reply(
          "❌ Usage:\n/botset bio Your Bio"
        );
      }

      const start = await api.sendMessage(
`╔════════════════════╗
║    📝 UPDATE BIO   ║
╚════════════════════╝

⏳ Starting Update...
`,
        threadID
      );

      const frames = [

`╔════════════════════╗
║    📝 UPDATE BIO   ║
╚════════════════════╝

░░░░░░░░░░ 0%

📥 Reading Text...
`,

`╔════════════════════╗
║    📝 UPDATE BIO   ║
╚════════════════════╝

███░░░░░░░ 25%

🧠 Processing Bio...
`,

`╔════════════════════╗
║    📝 UPDATE BIO   ║
╚════════════════════╝

██████░░░░ 50%

📡 Connecting Server...
`,

`╔════════════════════╗
║    📝 UPDATE BIO   ║
╚════════════════════╝

████████░░ 75%

⚙️ Updating Account...
`,

`╔════════════════════╗
║    📝 UPDATE BIO   ║
╚════════════════════╝

██████████ 100%

✅ BIO UPDATED
🤖 SABBIR CHAT BOT
`
      ];

      animate(start.messageID, frames, 800);

      try {

        if (typeof api.changeBio === "function") {

          await sleep(3500);

          await api.changeBio(newBio);

        } else {
          return api.sendMessage(
            "❌ api.changeBio not found in FCA.",
            threadID
          );
        }

      } catch (err) {
        return api.sendMessage(
          `❌ Bio Update Failed:\n${err.message}`,
          threadID
        );
      }
    }

    // =========================
    // HELP MENU
    // =========================

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
