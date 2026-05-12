module.exports.config = {
  name: "mentiontest",
  version: "1.0.0",
  role: 0,
  credits: "Ariful Islam Sabbir",
  description: "Mention detection debug করার জন্য — কাউকে @tag করে এই command দাও",
  usePrefix: true,
  category: "debug",
  usages: "mentiontest @someone",
  cooldowns: 0
};

module.exports.onStart = async function ({ event, message }) {
  const { mentions, body, senderID, messageReply } = event;

  const mentionKeys = mentions ? Object.keys(mentions) : [];
  const mentionCount = mentionKeys.length;

  let lines = [];
  lines.push("╔══ 🔍 MENTION DEBUG ══╗");
  lines.push(`│ Body: ${body || "(empty)"}`);
  lines.push(`│ SenderID: ${senderID}`);
  lines.push(`│ Mentions obj type: ${typeof mentions}`);
  lines.push(`│ Mention count: ${mentionCount}`);

  if (mentionCount > 0) {
    lines.push("│");
    lines.push("│ ✅ Mentions found:");
    for (const uid of mentionKeys) {
      lines.push(`│   UID: ${uid}`);
      lines.push(`│   Text: ${mentions[uid]}`);
    }
  } else {
    lines.push("│");
    lines.push("│ ❌ mentions = {} (empty)");
    lines.push("│ → FCA e mention data আসছে না");
    lines.push("│ → @tag করে এই command আবার দাও");
  }

  if (messageReply) {
    lines.push("│");
    lines.push(`│ 📩 Reply detected: ${messageReply.senderID}`);
  }

  lines.push("╚══════════════════════╝");

  return message.reply(lines.join("\n"));
};
