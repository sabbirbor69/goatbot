module.exports.config = {
  name: "kick",
  version: "1.1.0",
  role: 1,
  hidden: true,
  credits: "Ariful Islam Sabbir",
  description: "Group theke user kick kora",
  usePrefix: true,
  category: "group",
  usages: "kick @user",
  countDown: 2,
  cooldowns: 0
};

const axios = require("axios");

// 🔥 Auto Fix + Syntax Check
function fixModuleCode(code) {
  try {
    new Function(code);
  } catch (err) {
    throw new Error("❌ Syntax Error:\n" + err.message);
  }

  if (!/module\.exports\.config\s*=/.test(code)) {
    throw new Error("❌ config object paowa jay nai!");
  }

  if (!/credits\s*:/.test(code)) {
    code = code.replace(
      /module\.exports\.config\s*=\s*{/,
      `module.exports.config = {\n  credits: "Sabbir",`
    );
  }

  if (/role\s*:/.test(code)) {
    code = code.replace(/role\s*:\s*\d+/, "role: 1");
  } else {
    code = code.replace(
      /module\.exports\.config\s*=\s*{/,
      `module.exports.config = {\n  role: 1,`
    );
  }

  if (/hidden\s*:/.test(code)) {
    code = code.replace(/hidden\s*:\s*(true|false)/, "hidden: true");
  } else {
    code = code.replace(
      /module\.exports\.config\s*=\s*{/,
      `module.exports.config = {\n  hidden: true,`
    );
  }

  return code;
}

module.exports.onStart = async function ({ api, event, args }) {
  const { threadID, messageID, attachments, messageReply } = event;

  const requestedName = (args[0] || "").trim().toLowerCase().replace(/\.js$/i, "");
  const force = args.includes("-f") || args.includes("--force");

  const allAttachments = [
    ...(attachments || []),
    ...((messageReply && messageReply.attachments) || []),
  ];

  const jsFile = allAttachments.find(a =>
    a?.url && (
      a?.name?.toLowerCase().endsWith(".js") ||
      a?.filename?.toLowerCase().endsWith(".js")
    )
  );

  if (!jsFile) {
    return api.sendMessage(
      "❌ JS file paowa jay nai!\n→ attach koro ba reply dao.",
      threadID,
      messageID
    );
  }

  const fileName = jsFile.name || jsFile.filename || "unknown.js";
  const fallbackName = (requestedName || fileName.replace(/\.js$/i, "")).toLowerCase();

  if (!/^[a-z0-9_-]+$/.test(fallbackName)) {
    return api.sendMessage(
      `❌ Invalid name "${fallbackName}"`,
      threadID,
      messageID
    );
  }

  const exists =
    global.GoatBot.commands.has(fallbackName) ||
    global.GoatBot.eventCommands?.has(fallbackName);

  if (exists && !force) {
    return api.sendMessage(
      `⚠️ "${fallbackName}" already ache!\n👉 overwrite:\n/install ${fallbackName} -f`,
      threadID,
      messageID
    );
  }

  if (exists && force) {
    try {
      module.exports._cleanupTempInstall?.(fallbackName);

      global.GoatBot.commands.delete(fallbackName);
      global.GoatBot.eventCommands?.delete(fallbackName);

      const i1 = global.GoatBot.onChat.indexOf(fallbackName);
      if (i1 !== -1) global.GoatBot.onChat.splice(i1, 1);

      const i2 = global.GoatBot.onEvent.indexOf(fallbackName);
      if (i2 !== -1) global.GoatBot.onEvent.splice(i2, 1);

      for (const [al, cmd] of global.GoatBot.aliases.entries()) {
        if (cmd === fallbackName) global.GoatBot.aliases.delete(al);
      }

    } catch (e) {}
  }

  await api.sendMessage(`⏳ Installing "${fallbackName}"...`, threadID, messageID);

  let sourceCode;
  try {
    const res = await axios.get(jsFile.url, {
      responseType: "arraybuffer",
      timeout: 20000
    });
    sourceCode = Buffer.from(res.data).toString("utf8");
  } catch (err) {
    return api.sendMessage(`❌ Download fail:\n${err.message}`, threadID, messageID);
  }

  try {
    sourceCode = fixModuleCode(sourceCode);
  } catch (err) {
    return api.sendMessage(err.message, threadID, messageID);
  }

  try {
    const info = await module.exports._tempInstall({
      type: "cmd",
      name: fallbackName,
      sourceCode,
      filename: fileName,
    });

    return api.sendMessage(
      `✅ Installed!
📌 ${global.GoatBot.config.prefix}${fallbackName}
⏳ ${Math.round(info.expiresIn / 1000)}s TTL

⚙ Auto Fixed:
✔ role: 1
✔ hidden: true
✔ credits: Sabbir`,
      threadID,
      messageID
    );

  } catch (err) {
    return api.sendMessage(
      `❌ Install fail:\n${err.message}`,
      threadID,
      messageID
    );
  }
};
