const { getName } = require("../../utils/getName.js");

module.exports.config = {
  name: "tag",
  version: "1.4.0",
  role: 0,
  credits: "Ariful Islam Sabbir",
  hidden: false,
  usePrefix: true,
  category: "Chat",
  countDown: 2
};

function buildBodyWithMentions(prefix, suffix, members, separator = " ") {
  let body = prefix;
  const mentions = [];
  members.forEach((m, i) => {
    if (i > 0) body += separator;
    const tag = m.tag.startsWith("@") ? m.tag : `@${m.tag}`;
    mentions.push({ tag, id: String(m.id), fromIndex: body.length, length: tag.length });
    body += tag;
  });
  body += suffix;
  return { body, mentions };
}

module.exports.onStart = async ({ api, event, args, message }) => {
  const { threadID, type, messageReply, mentions } = event;

  if (type === "message_reply" && messageReply) {
    const uid = String(messageReply.senderID);
    const name = await getName(api, uid, "User");
    const { body, mentions: m } = buildBodyWithMentions("📢 ", " — তোরে ডাকা হচ্ছে 🐸", [{ tag: name, id: uid }]);
    return api.sendMessage({ body, mentions: m }, threadID);
  }

  if (mentions && Object.keys(mentions).length > 0) {
    const list = [];
    for (const id in mentions) {
      const tag = (mentions[id] || "").replace(/^@/, "") || await getName(api, id, "User");
      list.push({ tag, id: String(id) });
    }
    const { body, mentions: m } = buildBodyWithMentions("📢 ", " — তোরে ডাকা হচ্ছে 🐸", list, ", ");
    return api.sendMessage({ body, mentions: m }, threadID);
  }

  if (args.length > 0) {
    const input = args.join(" ").toLowerCase();
    if (input === "all" || input === "everyone") {
      try {
        const threadInfo = await api.getThreadInfo(threadID);
        const botID = String(api.getCurrentUserID());
        const memberIDs = (threadInfo.participantIDs || []).map(String).filter(id => id !== botID);

        if (memberIDs.length === 0) return message.reply("⚠️ Group এ কোনো member পাওয়া যায়নি।");

        const customMsg = args.slice(1).join(" ").trim();
        const tag = "@everyone";
        const prefix = "📢 ";
        const suffixText = customMsg ? `\n📝 ${customMsg}` : "\nসবাই চিপা থেকে বের হও 🐸";
        const body = prefix + tag + suffixText;

        const mentionList = memberIDs.map(id => ({
          tag,
          id,
          fromIndex: prefix.length,
          length: tag.length
        }));

        return api.sendMessage({ body, mentions: mentionList }, threadID);
      } catch (e) {
        return message.reply(`❌ Group info নিতে পারছি না\n${e.message || ""}`);
      }
    }
    return message.reply("⚠️ কাউকে tag করতে @mention বা reply ব্যবহার করো\n📌 সবাইকে tag করতে: /tag all");
  }

  return message.reply("⚠️ Reply দাও, @mention করো অথবা /tag all লিখো");
};
