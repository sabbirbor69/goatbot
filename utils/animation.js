"use strict";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeAndDelay(api, threadID, isGroup, ms) {
  if (typeof ms !== "number") ms = 1500;
  try {
    if (typeof api.sendTypingIndicator === "function") {
      api.sendTypingIndicator(true, threadID, (err) => {});
    }
  } catch (_) {}
  await sleep(ms);
  // Always turn off typing after the delay
  try {
    if (typeof api.sendTypingIndicator === "function") {
      api.sendTypingIndicator(false, threadID, (err) => {});
    }
  } catch (_) {}
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

  // Try edit-based animation first; fall back to a single sendMessage if edit fails
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

  // Try to edit with all lines incrementally
  let editWorked = false;
  for (let i = 0; i < lines.length; i++) {
    const textToEdit = lines.slice(0, i + 1).join("\n");
    const ok = await _editApi(api, sent.messageID, textToEdit);
    if (!ok) {
      // editMessage not supported — send the full message as a new message instead
      if (!editWorked) {
        try {
          await api.sendMessage({ body: lines.join("\n") }, threadID);
        } catch (_) {}
      }
      break;
    }
    editWorked = true;
    if (i < lines.length - 1) await sleep(perLineMs);
  }

  return sent;
}

module.exports = {
  sleep,
  typeAndDelay,
  animateSendLines
};
