const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { resolveTargets } = require("../../utils/resolveTarget.js");
const { loadingBar } = require("../../utils/animation.js");

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

module.exports.onStart = async function ({
  api,
  message,
  event,
  args
}) {
  const { threadID, messageID } = event;

  await loadingBar(api, threadID, messageID);

  try {
    let targetID = event.senderID;

    const result = await resolveTargets({ api, event, args });

    if (result.targets && result.targets.length > 0) {
      targetID = result.targets[0].uid;
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
