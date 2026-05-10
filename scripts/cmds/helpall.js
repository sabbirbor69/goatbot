const SABBIR = "Ariful Islam Sabbir";

module.exports.config = {
  name: "helpall",
  version: "3.0.0",
  hasPermssion: 0,
  credits: SABBIR,
  description: "সব command এক page এ দেখাবে",
  usePrefix: true,
  category: "Info",
  usages: "helpall",
  cooldowns: 5
};

module.exports.onStart = async function ({ api, event }) {

  const prefix =
    global.GoatBot.config.prefix || "/";

  const commands = global.GoatBot.commands;

  const cmdList = [];

  for (const [, cmd] of commands) {
    if (!cmd.config.hidden) {
      cmdList.push(cmd.config.name);
    }
  }

  cmdList.sort();

  const body = `
╔══✨ ALL COMMANDS ✨══╗
👑 Owner: ${SABBIR}

${cmdList.map((cmd, i) =>
`${i + 1}. ${prefix}${cmd}`
).join("\n")}

──────────────────────
📦 Total Commands: ${cmdList.length}
╚══════════════════════╝
`;

  api.sendMessage(
    body,
    event.threadID,
    event.messageID
  );
};
