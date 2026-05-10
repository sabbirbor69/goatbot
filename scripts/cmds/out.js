module.exports.config = {
  name: "out",
  version: "1.0.0",
  role: 1,
  credits: "Ariful Islam Sabbir",
  description: "Bot group থেকে leave নিবে",
  category: "Admin",
  countDown: 5
};

module.exports.onStart = async function ({ api, event }) {

  api.sendMessage(
    "👋 Goodbye Everyone...\nBot is leaving this group.",
    event.threadID,
    () => {
      api.removeUserFromGroup(
        api.getCurrentUserID(),
        event.threadID
      );
    }
  );

};
