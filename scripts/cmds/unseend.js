const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");

module.exports.config = {
  name: "unseend",
  version: "1.2.0",
  role: 0,
  credits: "ariful islam sabbir",
  description: "Auto resend removed messages",
  usePrefix: true,
  hidden: true,
  category: "System",
  countDown: 0,
  shortDescription: "কেউ message delete করলে সেটা দেখিয়ে দেয়"
};

if (!global.logMessage) global.logMessage = new Map();
if (!global.unseenEnabled) global.unseenEnabled = new Map();

module.exports.onStart = async function ({ api, event, threadsData }) {
  const { threadID, messageID, args } = event;

  const threadInfo = await threadsData.get(threadID);
  const currentStatus = threadInfo.data?.unseend !== false;
  const newStatus = !currentStatus;

  await threadsData.set(threadID, newStatus, "data.unseend");
  global.unseenEnabled.set(threadID, newStatus);

  return api.sendMessage(
    `Resend mode: ${newStatus ? "ON ✅" : "OFF ❌"}`,
    threadID,
    messageID
  );
};

module.exports.onEvent = async function ({ api, event, usersData }) {
  const { threadID, messageID, senderID, body, attachments, type } = event;

  if (senderID == api.getCurrentUserID()) return;

  const isEnabled = global.unseenEnabled.has(threadID)
    ? global.unseenEnabled.get(threadID)
    : true;

  if (!isEnabled) return;

  if (type !== "message_unsend") {
    global.logMessage.set(messageID, { msgBody: body || "", attachment: attachments || [] });
    return;
  }

  const msg = global.logMessage.get(messageID);
  if (!msg) return;

  let userName = "User";
  try {
    const userInfo = await api.getUserInfo(senderID);
    userName = userInfo[senderID]?.name || "User";
  } catch (e) {}

  if (!msg.attachment || msg.attachment.length === 0) {
    return api.sendMessage(
      `👀 সবাই দেখেন নাও!\n${userName} রিমুভ করেছে:\n${msg.msgBody || ""}`,
      threadID
    );
  }

  let attachmentsList = [];
  try {
    const cacheDir = path.join(__dirname, "cache");
    fs.ensureDirSync(cacheDir);
    let count = 0;
    for (const file of msg.attachment) {
      if (!file.url) continue;
      count++;
      const ext = (file.url.split(".").pop() || "jpg").split("?")[0];
      const filePath = path.join(cacheDir, `resend_${count}.${ext}`);
      const fileData = (await axios.get(file.url, { responseType: "arraybuffer" })).data;
      fs.writeFileSync(filePath, Buffer.from(fileData));
      attachmentsList.push(fs.createReadStream(filePath));
    }
  } catch (e) {
    attachmentsList = [];
  }

  return api.sendMessage(
    {
      body: `👀 সবাই দেখেন নাও!\n${userName} রিমুভ করেছে:\n${msg.msgBody || ""}`,
      attachment: attachmentsList
    },
    threadID
  );
};
