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
  try {
    if (typeof api.sendTypingIndicator === "function") {
      api.sendTypingIndicator(false, threadID, (err) => {});
    }
  } catch (_) {}
}

async function _editApi(api, messageID, newText) {
  if (typeof api.editMessage !== "function") return false;
  try {
    await api.editMessage(messageID, newText);
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

  let editWorked = false;
  for (let i = 0; i < lines.length; i++) {
    const textToEdit = lines.slice(0, i + 1).join("\n");
    const ok = await _editApi(api, sent.messageID, textToEdit);
    if (!ok) {
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

async function loadingBar(api, threadID, replyToMessageID) {
  const H = "╭─────❖─────╮\n   Loading...\n╰─────❖─────╯";
  const FRAMES = [
    `${H}\n\n0%   ░░░░░░░░░░`,
    `${H}\n\n0%   ░░░░░░░░░░\n25%  ██░░░░░░░░`,
    `${H}\n\n0%   ░░░░░░░░░░\n25%  ██░░░░░░░░\n50%  █████░░░░░`,
    `${H}\n\n0%   ░░░░░░░░░░\n25%  ██░░░░░░░░\n50%  █████░░░░░\n75%  ███████░░░`,
    `${H}\n\n0%   ░░░░░░░░░░\n25%  ██░░░░░░░░\n50%  █████░░░░░\n75%  ███████░░░\n100% ██████████\n\nDone ✔`,
  ];

  let sent;
  try {
    sent = await new Promise((resolve, reject) => {
      api.sendMessage(
        { body: FRAMES[0] },
        threadID,
        (err, info) => (err ? reject(err) : resolve(info)),
        replyToMessageID
      );
    });
  } catch (e) {
    return null;
  }

  if (!sent || !sent.messageID) return null;

  for (let i = 1; i < FRAMES.length; i++) {
    await sleep(350);
    try {
      await api.editMessage(sent.messageID, FRAMES[i]);
    } catch (_) {}
  }

  return sent;
}

module.exports = {
  sleep,
  typeAndDelay,
  animateSendLines,
  loadingBar
};
