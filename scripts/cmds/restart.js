module.exports.config = {
  name: "restart",
  version: "1.1.0",
  hasPermssion: 2,
  credits: "Ariful Islam Sabbir",
  description: "Bot restart করো",
  usePrefix: true,
  category: "Admin",
  usages: "restart",
  cooldowns: 5
};

module.exports.onStart = async function ({ api, event }) {
  const { senderID, threadID, messageID } = event;
  const lang = global.getText("commands", "restart");
  const adminList = (global.GoatBot?.config?.adminBot || global.GoatBot?.config?.adminID || []).map(String);

  if (!adminList.includes(String(senderID))) {
    return api.sendMessage(lang.noPermission, threadID, messageID);
  }

  await api.sendMessage(lang.restarting, threadID, messageID);

  setTimeout(() => {
    process.exit(2);
  }, 2000);
};
