"use strict";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeAndDelay(api, threadID, isGroup, ms) {
  if (typeof ms !== "number") ms = 2000;
  try {
    if (typeof api.sendTypingIndicator === "function") {
      api.sendTypingIndicator(threadID, (err) => {}, !!isGroup);
    }
  } catch (_) {}
  await sleep(ms);
}

async function _editApi(api, messageID, newText) {
  if (typeof api.editMessage !== "function") return false;
  try {
    await api.editMessage(newText, messageID);
    return true;
  } catch (err) {
    return false;
  }
}

async function animateSendLines(api, threadID, lines, opts) {
  opts = opts || {};
  const perLineMs = opts.perLineMs || 600; 
  const typingMs = opts.typingMs || 1500;
  const showTyping = opts.showTyping !== false;

  if (showTyping) {
    await typeAndDelay(api, threadID, opts.isGroup, typingMs);
  }

  let sent;
  try {
    sent = await new Promise((resolve, reject) => {
      api.sendMessage({ body: opts.initialBody || "✨ ..." }, threadID, (err, info) => {
        if (err) return reject(err);
        resolve(info);
      }, opts.replyToMessageID);
    });
  } catch (e) { return null; }

  if (!sent || !sent.messageID) return sent;

  for (let i = 0; i < lines.length; i++) {
    const textToEdit = lines.slice(0, i + 1).join("\n");
    const ok = await _editApi(api, sent.messageID, textToEdit);
    if (!ok) break; 
    if (i < lines.length - 1) await sleep(perLineMs);
  }
  return sent;
}

module.exports = {
  sleep,
  typeAndDelay,
  animateSendLines
};
