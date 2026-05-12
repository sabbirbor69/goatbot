const { getName } = require("../../utils/getName.js");

module.exports.config = {
  name: "autoadd",
  version: "2.0.0",
  role: 1,
  credits: "Ariful Islam Sabbir",
  usePrefix: true,
  hidden: false,
  category: "group",
  countDown: 3,
  shortDescription: "কেউ leave করলে bot auto add করবে",
  longDescription: "Group admin এই command দিয়ে autoadd চালু/বন্ধ করতে পারবে",
  guide: {
    en: "{pn} on/off",
    bn: "{pn} on/off"
  }
};

if (!global.autoAddEnabled)
  global.autoAddEnabled = new Map();

module.exports.onStart = async function ({
  event,
  args,
  message,
  threadsData
}) {
  const { threadID } = event;
  const sub = (args[0] || "").toLowerCase();

  if (!["on", "off"].includes(sub)) {
    return message.reply(
      "📌 ব্যবহার:\n" +
      "• /autoadd on\n" +
      "• /autoadd off"
    );
  }

  const enable = sub === "on";

  global.autoAddEnabled.set(threadID, enable);

  try {
    await threadsData.set(threadID, enable, "autoAdd");
  } catch (e) {}

  return message.reply(
    enable
      ? "✅ AutoAdd চালু হয়েছে"
      : "❌ AutoAdd বন্ধ হয়েছে"
  );
};

module.exports.onLoad = async function () {
  try {
    const allThreads = global.db?.allThreadData || [];

    for (const thread of allThreads) {
      if (thread?.data?.autoAdd === true) {
        global.autoAddEnabled.set(thread.threadID, true);
      }
    }
  } catch (e) {}
};

module.exports.onEvent = async function ({ api, event }) {
  try {
    const {
      threadID,
      logMessageType,
      logMessageData
    } = event;

    if (logMessageType !== "log:unsubscribe")
      return;

    if (!global.autoAddEnabled.get(threadID))
      return;

    const leftUserID = String(
      logMessageData?.leftParticipantFbId ||
      logMessageData?.removedParticipantFbId ||
      ""
    );

    if (!leftUserID)
      return;

    const botID = String(api.getCurrentUserID());

    if (leftUserID === botID)
      return;

    setTimeout(async () => {
      try {
        const userName = await getName(api, leftUserID, "User");

        await api.addUserToGroup(leftUserID, threadID);

        await api.sendMessage(
          `🔄 ${userName} কে আবার add করা হয়েছে`,
          threadID
        );

      } catch (err) {
        console.error("autoadd error:", err);

        await api.sendMessage(
          `⚠️ User কে auto add করা যায়নি`,
          threadID
        ).catch(() => {});
      }
    }, 2000);

  } catch (e) {
    console.error("autoadd onEvent error:", e);
  }
};
