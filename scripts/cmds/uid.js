const { resolveTargets } = require("../../utils/resolveTarget.js");

module.exports.config = {
  name: "uid",
  version: "1.2.0",
  hasPermssion: 0,
  credits: "Ariful Islam Sabbir",
  description: "নিজের বা অন্যের UID দেখাও",
  usePrefix: true,
  category: "Info",
  usages: "uid [@mention | @name | reply | uid]",
  cooldowns: 3
};

module.exports.onStart = async function ({ api, message, event, args }) {
  // Argument na thakle nije'r UID dao
  const hasArgOrReply = (args && args.length > 0) || event.messageReply || (event.mentions && Object.keys(event.mentions).length > 0);
  if (!hasArgOrReply) {
    return message.reply(`🆔 তোমার UID:\n\n🔢 ${event.senderID}`);
  }

  const result = await resolveTargets({ api, event, args });

  if (result.ambiguous) {
    let text = `⚠️ "${result.query}" — eki rokom name er ekadhik jon paoa gechhe. Specific kore din:\n\n`;
    result.candidates.forEach((c, i) => {
      text += `${i + 1}. ${c.name || "(no name)"} — 🔢 ${c.uid}\n`;
    });
    return message.reply(text.trim());
  }

  if (result.targets.length === 0) {
    if (result.error) return message.reply(`❌ Group info ana jaai ni: ${result.error}`);
    let msg = `❌ "${result.query || (args || []).join(" ")}" name er kau ke ei group e paini.`;
    if (result.available && result.available.length > 0) {
      msg += `\n\n📋 Group e ${result.totalParticipants} jon ache. Kichu name (UID shoho):\n`;
      result.available.forEach((c, i) => { msg += `${i + 1}. ${c.name} — 🔢 ${c.uid}\n`; });
      msg += `\nTry koro: /uid <UID>`;
    } else {
      msg += `\n\nTry koro:\n• Real @mention diye\n• Reply diye\n• Direct UID diye`;
    }
    return message.reply(msg.trim());
  }

  if (result.targets.length === 1 && result.targets[0].source === "reply") {
    return message.reply(`🆔 Reply করা ব্যক্তির UID:\n\n🔢 ${result.targets[0].uid}`);
  }

  let text = `🆔 UID তথ্য:\n\n`;
  for (const t of result.targets) {
    const label = t.name ? `👤 ${t.name}\n` : "";
    text += `${label}🔢 UID: ${t.uid}\n\n`;
  }
  return message.reply(text.trim());
};
