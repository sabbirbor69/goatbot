const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_DIR = path.join(process.cwd(), "tmp", "install_cache", "cmds");

global.GoatBot = global.GoatBot || {};
global.GoatBot.tempInstalls = global.GoatBot.tempInstalls || new Map();

function fmtMs(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${s}s`;
}

function cleanupTempInstall(name) {
  const entry = global.GoatBot.tempInstalls.get(name);
  if (!entry) return;
  clearTimeout(entry.timeoutHandle);
  global.GoatBot.tempInstalls.delete(name);

  if (entry.type === "cmd") {
    const cur = global.GoatBot.commands.get(name);
    if (cur && cur.__tempInstallId === entry.id) {
      global.GoatBot.commands.delete(name);
      const idxChat = global.GoatBot.onChat.indexOf(name);
      if (idxChat !== -1) global.GoatBot.onChat.splice(idxChat, 1);
      const idxEv = global.GoatBot.onEvent.indexOf(name);
      if (idxEv !== -1) global.GoatBot.onEvent.splice(idxEv, 1);
    }
    for (const al of entry.aliases || []) {
      if (global.GoatBot.aliases.get(al) === name) global.GoatBot.aliases.delete(al);
    }
  } else if (entry.type === "event") {
    const cur = global.GoatBot.eventCommands.get(name);
    if (cur && cur.__tempInstallId === entry.id) {
      global.GoatBot.eventCommands.delete(name);
    }
  }

  try {
    if (entry.filePath && fs.existsSync(entry.filePath)) {
      delete require.cache[require.resolve(entry.filePath)];
      fs.removeSync(entry.filePath);
    }
  } catch (e) {}
}

module.exports._cleanupTempInstall = cleanupTempInstall;
module.exports._tempInstall = async function tempInstall({ type, name, sourceCode, filename }) {
  const dir = type === "event"
    ? path.join(process.cwd(), "tmp", "install_cache", "events")
    : CACHE_DIR;
  fs.ensureDirSync(dir);

  if (global.GoatBot.tempInstalls.has(name)) {
    cleanupTempInstall(name);
  }

  const filePath = path.join(dir, `${name}.js`);
  fs.writeFileSync(filePath, sourceCode, "utf8");

  let mod;
  try {
    delete require.cache[require.resolve(filePath)];
    mod = require(filePath);
  } catch (err) {
    try { fs.removeSync(filePath); } catch (e) {}
    const isSyntax = err && (err.name === "SyntaxError" || /SyntaxError|Unexpected/i.test(err.message || ""));
    const head = isSyntax ? "❌ Syntax Error" : "❌ Load Error";
    let detail = err.message || String(err);
    const stackFirst = (err.stack || "").split("\n").slice(0, 4).join("\n");
    throw new Error(`${head}\n${detail}\n\n${stackFirst}`);
  }

  if (!mod || !mod.config || !mod.config.name || !mod.onStart) {
    try { fs.removeSync(filePath); } catch (e) {}
    throw new Error("❌ Invalid format: 'config.name' এবং 'onStart' দুটোই দরকার!");
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  mod.__tempInstallId = id;
  mod.location = filePath;

  const aliases = Array.isArray(mod.config.aliases) ? mod.config.aliases.slice() : [];

  if (type === "cmd") {
    global.GoatBot.commands.set(name, mod);
    for (const al of aliases) global.GoatBot.aliases.set(al, name);
    if (mod.onChat && !global.GoatBot.onChat.includes(name)) global.GoatBot.onChat.push(name);
    if (mod.onEvent && !global.GoatBot.onEvent.includes(name)) global.GoatBot.onEvent.push(name);
  } else {
    global.GoatBot.eventCommands.set(name, mod);
  }

  const timeoutHandle = setTimeout(() => cleanupTempInstall(name), TTL_MS);
  if (timeoutHandle.unref) timeoutHandle.unref();

  global.GoatBot.tempInstalls.set(name, {
    id, type, filePath, timeoutHandle,
    expiresAt: Date.now() + TTL_MS,
    aliases,
    filename: filename || `${name}.js`,
  });

  return { id, expiresIn: TTL_MS, aliases };
};

module.exports.config = {
  name: "install",
  version: "2.0.0",
  role: 2,
  credits: "Ariful Islam Sabbir",
  description: "Temporary cache e command install (5 min TTL)",
  usePrefix: true,
  category: "Admin",
  usages: "install <cmdName>  (.js file attach koro / reply dao)",
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
      "❌ JS file paowa jay nai!\n→ ekta .js file attach koro, ba ekta JS file e reply diye `/install <cmdName>` likho.",
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

  await api.sendMessage(`⏳ Installing "${fallbackName}" to temp cache (5 min TTL)...`, threadID, messageID);

  let sourceCode;
  try {
    const res = await axios.get(jsFile.url, { responseType: "arraybuffer", timeout: 20000 });
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
    const aliasNote = info.aliases.length ? `\n🔗 Aliases: ${info.aliases.join(", ")}` : "";
    return api.sendMessage(
      `✅ Installed (TEMP CACHE)\n📌 Command: ${global.GoatBot.config.prefix}${fallbackName}\n⏳ TTL: ${fmtMs(info.expiresIn)} (auto-remove)${aliasNote}\n💡 Permanently rakhte chao? File ta scripts/cmds/ folder e save koro.`,
      threadID, messageID
    );
  } catch (err) {
    return api.sendMessage(err.message, threadID, messageID);
  }
};
