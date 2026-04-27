const axios = require("axios");
const installCmd = require("./install.js");

function fmtMs(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${s}s`;
}

module.exports.config = {
  name: "installevent",
  version: "1.0.0",
  role: 2,
  credits: "Ariful Islam Sabbir",
  description: "Temporary cache e event install (5 min TTL)",
  usePrefix: true,
  category: "Admin",
  usages: "installevent <eventName>  (.js file attach koro / reply dao)",
  cooldowns: 5,
};

module.exports.onStart = async function ({ api, event, args }) {
  const { threadID, messageID, attachments, messageReply } = event;

  const requestedName = (args[0] || "").trim().toLowerCase().replace(/\.js$/i, "");

  const allAttachments = [
    ...(attachments || []),
    ...((messageReply && messageReply.attachments) || []),
  ];
  const jsFile = allAttachments.find(a =>
    (a && a.url) && (
      (a.name && a.name.toLowerCase().endsWith(".js")) ||
      (a.filename && a.filename.toLowerCase().endsWith(".js"))
    )
  );

  if (!jsFile) {
    return api.sendMessage(
      "❌ JS file paowa jay nai!\n→ ekta .js event file attach koro, ba JS file e reply diye `/installevent <eventName>` likho.",
      threadID, messageID
    );
  }

  const fileName = jsFile.name || jsFile.filename;
  const fallbackName = (requestedName || fileName.replace(/\.js$/i, "")).toLowerCase();

  if (!/^[a-z0-9_-]+$/.test(fallbackName)) {
    return api.sendMessage(
      `❌ Invalid name "${fallbackName}". Sudhu a-z, 0-9, _ , - allowed.`,
      threadID, messageID
    );
  }

  await api.sendMessage(`⏳ Installing event "${fallbackName}" to temp cache (5 min TTL)...`, threadID, messageID);

  let sourceCode;
  try {
    const res = await axios.get(jsFile.url, { responseType: "arraybuffer", timeout: 20000 });
    sourceCode = Buffer.from(res.data).toString("utf8");
  } catch (err) {
    return api.sendMessage(`❌ File download fail: ${err.message}`, threadID, messageID);
  }

  try {
    const info = await installCmd._tempInstall({
      type: "event",
      name: fallbackName,
      sourceCode,
      filename: fileName,
    });
    return api.sendMessage(
      `✅ Event Installed (TEMP CACHE)\n📌 Event: ${fallbackName}\n⏳ TTL: ${fmtMs(info.expiresIn)} (auto-remove)\n💡 Permanently rakhte chao? File ta scripts/events/ folder e save koro.`,
      threadID, messageID
    );
  } catch (err) {
    return api.sendMessage(err.message, threadID, messageID);
  }
};
