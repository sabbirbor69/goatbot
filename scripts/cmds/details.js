const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { resolveTargets } = require("../../utils/resolveTarget.js");

module.exports.config = {
  name: "details",
  version: "10.0.0",
  hasPermssion: 0,
  credits: "Ariful Islam Sabbir",
  description: "User details with animation and HD picture",
  usePrefix: true,
  category: "Info",
  usages: "details [@mention | @name | reply | uid]",
  cooldowns: 5
};

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

module.exports.onStart = async function ({
  api,
  message,
  event,
  args
}) {
  const { threadID } = event;

  try {
    let targetID = event.senderID;

    // resolveTargets use
    const result = await resolveTargets({
      api,
      event,
      args
    });

    if (
      result.targets &&
      result.targets.length > 0
    ) {
      targetID =
        result.targets[0].uid;
    }

    // Animation Start
    const start =
      await api.sendMessage(
`╔════════════════════╗
║   👤 USER DETAILS   ║
╚════════════════════╝

⏳ Starting Scan...
`,
        threadID
      );

    const frames = [

`╔════════════════════╗
║   👤 USER DETAILS   ║
╚════════════════════╝

░░░░░░░░░░ 0%

📥 Fetching User Data...
`,

`╔════════════════════╗
║   👤 USER DETAILS   ║
╚════════════════════╝

███░░░░░░░ 25%

🧠 Processing Profile...
`,

`╔════════════════════╗
║   👤 USER DETAILS   ║
╚════════════════════╝

█████░░░░░ 50%

📡 Connecting Facebook...
`,

`╔════════════════════╗
║   👤 USER DETAILS   ║
╚════════════════════╝

████████░░ 75%

🖼️ Downloading HD Photo...
`,

`╔════════════════════╗
║   👤 USER DETAILS   ║
╚════════════════════╝

██████████ 100%

✅ DETAILS READY
🤖 SABBIR CHAT BOT
`
    ];

    for (const frame of frames) {
      await sleep(1200);

      try {
        await api.editMessage(
          frame,
          start.messageID
        );
      } catch (e) {}
    }

    // User Info
    const userInfo =
      await api.getUserInfo(
        targetID
      );

    const user =
      userInfo[targetID];

    if (!user) {
      return message.reply(
        "❌ User not found."
      );
    }

    const name =
      user.name || "N/A";

    const gender =
      user.gender === 2
        ? "Male"
        : user.gender === 1
        ? "Female"
        : "Unknown";

    const username =
      user.vanity || "N/A";

    const msg = `
╔════════════════════════════╗
║      ✦ SABBIR BOT ✦       ║
╠════════════════════════════╣
║ 👤 Name : ${name}
║ 🆔 UID  : ${targetID}
║ ⚧ Gender : ${gender}
║ 🔗 Username : ${username}
╠════════════════════════════╣
║ 🌐 Profile Link
║ facebook.com/profile.php?id=${targetID}
╚════════════════════════════╝
`;

    // HD Photo
    const avatarURL =
`https://graph.facebook.com/${targetID}/picture?width=1024&height=1024&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;

    const res =
      await axios.get(
        avatarURL,
        {
          responseType:
            "arraybuffer"
        }
      );

    const tmpPath =
      path.join(
        __dirname,
        `../../tmp/details_${targetID}.jpg`
      );

    await fs.outputFile(
      tmpPath,
      res.data
    );

    await message.reply({
      body: msg,
      attachment:
        fs.createReadStream(
          tmpPath
        )
    });

    await fs.remove(
      tmpPath
    );

  } catch (err) {
    console.error(err);

    return message.reply(
      "❌ Error occurred."
    );
  }
};
