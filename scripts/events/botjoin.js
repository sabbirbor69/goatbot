module.exports.config = {
  name: "botjoin",
  version: "1.0.0",
  role: 0,
  credits: "Ariful Islam Sabbir",
  description: "Bot কোনো group এ join করলে নিজের nickname সেট করে",
  category: "Events",
  hidden: true,
  countDown: 0
};

const BOT_NICKNAME = "𝑺𝑨𝑩𝑩𝑰𝑹 𝑮𝑶𝑨𝑻 𝑩𝑶𝑻";

module.exports.onStart = async function ({ api, event }) {
  try {
    if (event.logMessageType !== "log:subscribe") return;

    const { threadID, logMessageData } = event;
    const botID = String(api.getCurrentUserID());

    const addedParticipants = logMessageData?.addedParticipants || [];
    const botWasAdded = addedParticipants.some(
      p => String(p.userFbId || p.id) === botID
    );

    if (!botWasAdded) return;

    // সামান্য delay দিয়ে nickname set করা
    setTimeout(async () => {
      try {
        await api.nickname(BOT_NICKNAME, threadID, botID);
      } catch (e) {
        // permission না থাকলে চুপ থাকবে
      }
    }, 2000);

  } catch (e) {}
};
