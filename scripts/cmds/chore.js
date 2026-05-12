const { loadingBar } = require("../../utils/animation.js");

const axios = require("axios");
const Jimp = require("jimp");
const fs = require("fs-extra");
const path = require("path");

const resolvePath = path.join(process.cwd(), 'utils', 'resolveTarget.js');
let resolveTargets;
try {
  resolveTargets = require(resolvePath).resolveTargets;
} catch (e) {
  console.log("resolveTarget utility not found.");
}

module.exports.config = {
  name: "chore",
  version: "3.0.0",
  hasPermssion: 0,
  credits: "Ariful Islam Sabbir",
  description: "Sender and Target PP meme",
  usePrefix: true,
  category: "Edit",
  usages: "chore [@mention | reply]",
  cooldowns: 5
};

module.exports.onStart = async function ({ api, event, args }) {
  await loadingBar(api, event.threadID, event.messageID);


  const { threadID, messageID, senderID } = event;

  try {
    let targetID = null;
    if (resolveTargets) {
      const result = await resolveTargets({ api, event, args });
      if (result.targets && result.targets.length > 0) targetID = result.targets[0].uid;
    } else {
      if (event.messageReply) targetID = event.messageReply.senderID;
      else if (Object.keys(event.mentions || {}).length > 0) targetID = Object.keys(event.mentions)[0];
    }

    if (!targetID) return api.sendMessage("⚠️ Doya kore kauke mention korun!", threadID, messageID);

    api.sendMessage("⏳ Meme toiri hocche...", threadID, messageID);

    const userInfo = await api.getUserInfo(targetID);
    const targetName = userInfo[targetID] ? userInfo[targetID].name : "চোর";

    const imgLink = "https://i.ibb.co.com/0jDzs9xq/file-00000000abf871fab90e3d6afab380f3.png";
    const token = "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";
    
    // Duijoner PP URL
    const senderURL = `https://graph.facebook.com/${senderID}/picture?width=512&height=512&access_token=${token}`;
    const targetURL = `https://graph.facebook.com/${targetID}/picture?width=512&height=512&access_token=${token}`;
    
    const cachePath = path.join(process.cwd(), 'cache', `murgi_${senderID}_${targetID}.png`);

    const [baseImage, senderPP, targetPP] = await Promise.all([
      Jimp.read(imgLink),
      Jimp.read((await axios.get(senderURL, { responseType: 'arraybuffer' })).data),
      Jimp.read((await axios.get(targetURL, { responseType: 'arraybuffer' })).data)
    ]);

    // Sender PP (Ekta jaigai)
    senderPP.circle().resize(70, 70);
    baseImage.composite(senderPP, 50, 160); // Sender er jaiga (adjust korun)

    // Target PP (Onno jaigai)
    targetPP.circle().resize(80, 80);
    baseImage.composite(targetPP, 200, 140); // Target er jaiga

    await baseImage.writeAsync(cachePath);

    return api.sendMessage({
      body: `শালা মুরগি চোর ${targetName}\nশশুর বাড়িতে গিয়ে মুরগি চুরি করতে গিয়ে ধরা খাইসে!`,
      attachment: fs.createReadStream(cachePath)
    }, threadID, () => fs.unlinkSync(cachePath), messageID);

  } catch (err) {
    console.error(err);
    return api.sendMessage("❌ Error: PP load ba edit e somossa.", threadID, messageID);
  }
}
