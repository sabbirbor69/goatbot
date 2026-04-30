module.exports.onStart = async function ({ api, event, args }) {
  const { threadID, messageID, attachments, messageReply } = event;

  const requestedName = (args[0] || "").trim().toLowerCase().replace(/\.js$/i, "");
  const force = args.includes("-f") || args.includes("--force");

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
      "❌ JS file paowa jay nai!\n→ ekta .js file attach koro, ba reply diye `/install <cmdName>` likho.",
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

  // 🔴 Check existing command
  if (global.GoatBot.commands.has(fallbackName) && !force) {
    return api.sendMessage(
      `⚠️ "${fallbackName}" command already ache!\n\n👉 Overwrite korte chaile use koro:\n/install ${fallbackName} -f`,
      threadID,
      messageID
    );
  }

  // 🧹 Delete old if force
  if (global.GoatBot.commands.has(fallbackName) && force) {
    try {
      module.exports._cleanupTempInstall(fallbackName);

      global.GoatBot.commands.delete(fallbackName);
      const idxChat = global.GoatBot.onChat.indexOf(fallbackName);
      if (idxChat !== -1) global.GoatBot.onChat.splice(idxChat, 1);

      const idxEv = global.GoatBot.onEvent.indexOf(fallbackName);
      if (idxEv !== -1) global.GoatBot.onEvent.splice(idxEv, 1);

      for (const [al, cmd] of global.GoatBot.aliases.entries()) {
        if (cmd === fallbackName) global.GoatBot.aliases.delete(al);
      }

    } catch (e) {}
  }

  await api.sendMessage(
    `⏳ Installing "${fallbackName}"...`,
    threadID,
    messageID
  );

  let sourceCode;
  try {
    const res = await axios.get(jsFile.url, {
      responseType: "arraybuffer",
      timeout: 20000
    });
    sourceCode = Buffer.from(res.data).toString("utf8");
  } catch (err) {
    return api.sendMessage(`❌ File download fail: ${err.message}`, threadID, messageID);
  }

  try {
    const info = await module.exports._tempInstall({
      type: "cmd",
      name: fallbackName,
      sourceCode,
      filename: fileName,
    });

    return api.sendMessage(
      `✅ Installed Successfully!\n📌 Command: ${global.GoatBot.config.prefix}${fallbackName}\n⏳ TTL: ${fmtMs(info.expiresIn)}\n💡 Permanent korte hole scripts/cmds e save koro.`,
      threadID,
      messageID
    );

  } catch (err) {
    return api.sendMessage(err.message, threadID, messageID);
  }
};
