const { loadingBar } = require("../../utils/animation.js");

module.exports.config = {
  name: "restart",
  version: "6.0.0",
  role: 2,
  credits: "Ariful Islam Sabbir",
  description: "Bot restart with cache clear",
  category: "Admin",
  cooldowns: 5
};

module.exports.onStart = async function ({ api, event }) {
  const { threadID, messageID } = event;

  await loadingBar(api, threadID, messageID);

  Object.keys(require.cache).forEach(key => {
    if (
      key.includes("/scripts/") ||
      key.includes("/utils/") ||
      key.includes("/includes/") ||
      key.includes("/database/") ||
      key.includes("/sabbir-fca/")
    ) {
      delete require.cache[key];
    }
  });

  try {
    await api.sendMessage("🔄 Bot restarting... 10 সেকেন্ড পরে আবার আসব!", threadID);
  } catch (_) {}

  process.exit(2);
};
