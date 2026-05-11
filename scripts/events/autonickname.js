const { getName } = require("../../utils/getName.js");
const { animateSendLines, sleep } = require("../../utils/animation.js");

module.exports.config = {
  name: "autonickname",
  version: "1.1.0",
  role: 0,
  credits: "Ariful Islam Sabbir",
  description: "Bot গ্রুপে join করলে নিজের nickname সেট + welcome message; অন্য কেউ join করলে template অনুযায়ী auto nickname",
  category: "Events",
  countDown: 0
};

const BOT_NICKNAME = "▭▭▭ 𝕊𝔸𝔹𝔹𝕀ℝ ℂℍ𝔸𝕋 𝔹𝕆𝕋 ▭▭▭";

function applyTemplate(template, fullName) {
  const safe = (template || "").toString();
  const firstName = (fullName || "").trim().split(/\s+/)[0] || fullName || "";
  return safe
    .replace(/\{name\}/gi, fullName || "")
    .replace(/\{firstname\}/gi, firstName)
    .trim();
}

async function botSelfWelcome(api, threadID, isGroup) {
  try { await api.changeNickname(BOT_NICKNAME, threadID, String(api.getCurrentUserID())); } catch (_) {}

  const lines = [
"╔══ HELLO EVERYONE ══╗",
"I AM SABBIR CHAT BOT",
"OWNER: MD ARIFUL ISLAM SABBIR",
"TYPE /help FOR ALL COMMANDS",
"INFO: /info FOR ADMIN DETAILS",
"STATUS: ACTIVE AND READY TO HELP",
"THANK YOU FOR ADDING ME",
"╚══════════════════════╝"
];

  await animateSendLines(api, threadID, lines, {
    initialBody: "✨ ...",
    perLineMs: 200,
    isGroup: !!isGroup,
    showTyping: true,
    typingMs: 1200
  });
}

module.exports.onStart = async function ({ api, event, threadsData }) {
  if (event.logMessageType !== "log:subscribe") return;

  const { threadID, logMessageData } = event;
  const addedIDs = (logMessageData && logMessageData.addedParticipants) || [];
  if (addedIDs.length === 0) return;

  const botID = String(api.getCurrentUserID());

  let cfg = null;
  try {
    const td = await threadsData.getData(threadID);
    cfg = (td && td.data && td.data.autoNickname) || null;
  } catch (_) {}

  for (const added of addedIDs) {
    const userID = String(added.userFbId || added.id || "").replace(/^fbid:/, "");
    if (!userID) continue;

    if (userID === botID) {
      await botSelfWelcome(api, threadID, true);
      await sleep(400);
      continue;
    }

    if (!cfg || cfg.enabled !== true) continue;

    const template = cfg.template || "Member {firstname}";
    let name = added.fullName || added.name || "";
    if (!name || name === "Facebook User") {
      try { name = await getName(api, userID, ""); } catch (_) {}
    }

    const nickname = applyTemplate(template, name);
    if (!nickname) continue;

    try {
      await api.changeNickname(nickname, threadID, userID);
    } catch (e) {
      try { console.log(`[autonickname] failed for ${userID} in ${threadID}: ${(e && (e.error || e.message)) || e}`); } catch (_) {}
    }
    await sleep(500);
  }
};
