const installCmd = require("./install.js");

module.exports.config = {
  name: "delete",
  version: "1.0.0",
  role: 2,
  credits: "Ariful Islam Sabbir",
  aliases: ["delet", "del", "uninstall"],
  description: "Temporary cache theke install kora command/event remove kore",
  usePrefix: true,
  category: "Admin",
  usages: "delete <name>",
  cooldowns: 3,
};

module.exports.onStart = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  const name = (args[0] || "").trim().toLowerCase().replace(/\.js$/i, "");
  if (!name) {
    return api.sendMessage(
      "❌ Name dao!\n→ Example: /delete myCmd",
      threadID, messageID
    );
  }

  global.GoatBot = global.GoatBot || {};
  global.GoatBot.tempInstalls = global.GoatBot.tempInstalls || new Map();

  const entry = global.GoatBot.tempInstalls.get(name);
  if (!entry) {
    return api.sendMessage(
      `❌ "${name}" temp cache e nai.\n→ Note: /delete sudhu /install ba /installevent diye install kora item delete kore. Permanent files (scripts/cmds/, scripts/events/) e hath dey na.`,
      threadID, messageID
    );
  }

  const type = entry.type;
  installCmd._cleanupTempInstall(name);

  return api.sendMessage(
    `🗑️ Deleted from cache: ${type === "event" ? "event" : "command"} "${name}"`,
    threadID, messageID
  );
};
