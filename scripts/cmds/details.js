module.exports.config = {
  name: "details",
  version: "8.0.0",
  hasPermssion: 0,
  credits: "Ariful Islam Sabbir",
  description: "User details with stylish animated box and HD picture",
  usePrefix: true,
  category: "Info",
  usages: "details [@mention | reply | UID]",
  cooldowns: 5
};

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// ResolveTarget Utility
const resolvePath = path.join(process.cwd(), "utils", "resolveTarget.js");

let resolveTargets;

try {
  resolveTargets = require(resolvePath).resolveTargets;
} catch (e) {
  console.log("resolveTarget utility not found.");
}

module.exports.onStart = async function ({
  api,
  event,
  args
}) {
  const { threadID, messageID, senderID } = event;

  try {
    let targetID = senderID;

    // Resolve Target
    if (resolveTargets) {
      const result = await resolveTargets({
        api,
        event,
        args
      });

      if (
        result.targets &&
        result.targets.length > 0
      ) {
        targetID = result.targets[0].uid;
      }
    } else {
      if (event.messageReply) {
        targetID =
          event.messageReply.senderID;
      } else if (
        Object.keys(event.mentions || {})
          .length > 0
      ) {
        targetID = Object.keys(
          event.mentions
        )[0];
      } else if (
        args[0] &&
        !isNaN(args[0])
      ) {
        targetID = args[0];
      }
    }

    // Start Animation
    const start = await api.sendMessage(
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

██████░░░░ 50%

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
      await new Promise(resolve =>
        setTimeout(resolve, 1000)
      );

      await api.editMessage(
        frame,
        start.messageID
      );
    }

    // User Info
    const userInfo =
      await api.getUserInfo(targetID);

    const user = userInfo[targetID];

    if (!user) {
      return api.sendMessage(
        "❌ User info not found.",
        threadID,
        messageID
      );
    }

    const name = user.name || "N/A";

    const gender =
      user.gender === 2
        ? "𝐌𝐚𝐥𝐞"
        : user.gender === 1
        ? "𝐅𝐞𝐦𝐚𝐥𝐞"
        : "𝐔𝐧𝐤𝐧𝐨𝐰𝐧";

    const username =
      user.vanity || "N/A";

    // Stylish Final Box
    const msg = `
╔══════════════════════════════╗
║      ✦ 𝐒𝐀𝐁𝐁𝐈𝐑 𝐁𝐎𝐓 ✦       ║
╠══════════════════════════════╣
║ 👤 𝐍𝐚𝐦𝐞      : ${name}
║ 🟢 𝐒𝐭𝐚𝐭𝐮𝐬    : 𝐎𝐧𝐥𝐢𝐧𝐞
║ 🆔 𝐔𝐈𝐃       : ${targetID}
║ ⚧ 𝐆𝐞𝐧𝐝𝐞𝐫    : ${gender}
║ 🌍 𝐋𝐨𝐜𝐚𝐭𝐢𝐨𝐧  : 𝐍/𝐀
║ 🔗 𝐔𝐬𝐞𝐫𝐧𝐚𝐦𝐞 : ${username}
╠══════════════════════════════╣
║ 🌐 𝐏𝐫𝐨𝐟𝐢𝐥𝐞 𝐋𝐢𝐧𝐤
║ https://facebook.com/profile.php?id=${targetID}
╚══════════════════════════════╝
`;

    // HD Profile Picture
    const avatarURL =
`https://graph.facebook.com/${targetID}/picture?width=1024&height=1024&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;

    const res = await axios.get(
      avatarURL,
      {
        responseType: "arraybuffer"
      }
    );

    const cacheDir = path.join(
      process.cwd(),
      "cache"
    );

    await fs.ensureDir(cacheDir);

    const imgPath = path.join(
      cacheDir,
      `details_${targetID}.jpg`
    );

    await fs.outputFile(
      imgPath,
      res.data
    );

    // Send Final Message
    await api.sendMessage(
      {
        body: msg,
        attachment:
          fs.createReadStream(imgPath)
      },
      threadID,
      () => {
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      },
      messageID
    );

  } catch (err) {
    console.log(err);

    return api.sendMessage(
      "❌ Error occurred while fetching details.",
      threadID,
      messageID
    );
  }
};
