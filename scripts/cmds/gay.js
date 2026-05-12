const axios = require("axios");
const Jimp = require("jimp");
const fs = require("fs-extra");
const path = require("path");

// resolveTarget.js pwd diye call
const resolvePath = path.join(process.cwd(), "utils", "resolveTarget.js");

let resolveTargets;

try {
  resolveTargets = require(resolvePath).resolveTargets;
} catch (e) {
  console.log("resolveTarget utility not found.");
}

module.exports.config = {
  name: "gay",
  version: "3.0.2",
  hasPermssion: 0,
  credits: "Ariful Islam Sabbir",
  description: "Funny gay meme edit",
  usePrefix: true,
  category: "Edit",
  usages: "gay [@mention | reply]",
  cooldowns: 5
};

module.exports.onStart = async function ({ api, event, args }) {

  const { threadID, messageID, senderID } = event;

  try {

    let targetID = null;

    if (resolveTargets) {

      const result = await resolveTargets({
        api,
        event,
        args
      });

      if (result.targets && result.targets.length > 0) {
        targetID = result.targets[0].uid;
      }

    } else {

      if (event.messageReply) {
        targetID = event.messageReply.senderID;
      }

      else if (Object.keys(event.mentions || {}).length > 0) {
        targetID = Object.keys(event.mentions)[0];
      }

    }

    if (!targetID) {
      return api.sendMessage(
        "⚠️ Doya kore kauke mention/reply korun!",
        threadID,
        messageID
      );
    }

    const userInfo = await api.getUserInfo(targetID);

    const targetName = userInfo[targetID]
      ? userInfo[targetID].name
      : "Unknown";

    // Template image
    const imgLink = "https://i.imgur.com/TbzCudw.jpeg";

    const token =
      "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";

    // Profile Picture URL
    const targetURL =
      `https://graph.facebook.com/${targetID}/picture?width=512&height=512&access_token=${token}`;

    const cachePath = path.join(
      process.cwd(),
      "cache",
      `gay_${senderID}_${targetID}.png`
    );

    const [baseImage, targetPP] = await Promise.all([

      Jimp.read(imgLink),

      Jimp.read(
        (
          await axios.get(targetURL, {
            responseType: "arraybuffer"
          })
        ).data
      )

    ]);

    // PP resize + circle
    targetPP.circle().resize(95, 95);

    // Face er exact position
    baseImage.composite(targetPP, 200, 108);

    // Save final image
    await baseImage.writeAsync(cachePath);

    return api.sendMessage(
      {
        body: `🌈 ${targetName} officially certified gay 😹`,
        attachment: fs.createReadStream(cachePath)
      },
      threadID,
      () => {
        if (fs.existsSync(cachePath)) {
          fs.unlinkSync(cachePath);
        }
      },
      messageID
    );

  } catch (err) {

    console.error(err);

    return api.sendMessage(
      `❌ Error: ${err.message}`,
      threadID,
      messageID
    );

  }

};
