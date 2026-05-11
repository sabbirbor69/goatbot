module.exports.config = {
  name: "restart",
  version: "5.0.0",
  role: 2,
  credits: "Ariful Islam Sabbir",
  description: "Animated Restart System",
  category: "Admin",
  cooldowns: 5
};

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

module.exports.onStart = async function ({
  api,
  event
}) {

  const threadID = event.threadID;

  const start = await api.sendMessage(
`╔════════════════════╗
║   🔄 RESTART BOT   ║
╚════════════════════╝

⚡ Initializing Restart...
`,
    threadID
  );

  const frames = [

`╔════════════════════╗
║   🔄 RESTART BOT   ║
╚════════════════════╝

░░░░░░░░░░ 0%

⚡ Initializing Restart...`,

`╔════════════════════╗
║   🔄 RESTART BOT   ║
╚════════════════════╝

███░░░░░░░ 25%

💾 Saving session...`,

`╔════════════════════╗
║   🔄 RESTART BOT   ║
╚════════════════════╝

█████░░░░░ 50%

🧠 Clearing cache...`,

`╔════════════════════╗
║   🔄 RESTART BOT   ║
╚════════════════════╝

████████░░ 75%

📡 Reconnecting MQTT...`,

`╔════════════════════╗
║   🔄 RESTART BOT   ║
╚════════════════════╝

██████████ 100%

✅ BOT RESTARTED SUCCESSFULLY
📡 MQTT Connected
🤖 SABBIR CHAT BOT ONLINE`
  ];

  for (const frame of frames) {

    await sleep(1200);

    try {

      await api.editMessage(
        start.messageID,
        frame
      );

    } catch (e) {
      console.log(e);
    }
  }

  setTimeout(() => {
    process.exit(2);
  }, 5000);

};
