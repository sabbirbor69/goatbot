module.exports.config = {
  name: "autonickname",
  version: "1.0.0",
  role: 1,
  credits: "Ariful Islam Sabbir",
  description: "Group এ join হলে auto nickname সেট করার feature নিয়ন্ত্রণ করো",
  category: "Group",
  usages:
    "autonickname on | off | status\n" +
    "autonickname set <template>   (template এ {name} বা {firstname} ব্যবহার করো)\n" +
    "autonickname all              (এখনই সব member এর nickname এক সাথে সেট করো)\n" +
    "autonickname reset            (সব member এর nickname মুছে দাও)",
  cooldowns: 5
};

function applyTemplate(template, fullName) {
  const safe = (template || "").toString();
  const firstName = (fullName || "").trim().split(/\s+/)[0] || fullName || "";
  return safe
    .replace(/\{name\}/gi, fullName || "")
    .replace(/\{firstname\}/gi, firstName)
    .trim();
}

async function getCfg(threadsData, threadID) {
  let td = null;
  try { td = await threadsData.getData(threadID); } catch (_) {}
  const data = (td && td.data) || {};
  const cfg = data.autoNickname || { enabled: false, template: "Member {firstname}" };
  return { td, data, cfg };
}

async function saveCfg(threadsData, threadID, data, cfg) {
  data.autoNickname = cfg;
  try {
    await threadsData.setData(threadID, { data });
  } catch (_) {
    try { await threadsData.createData(threadID, { data }); } catch (_) {}
  }
}

module.exports.onStart = async function ({ api, event, threadsData }) {
  const { threadID, messageID, body } = event;
  const args = (body || "").trim().split(/\s+/);
  args.shift();
  const sub = (args.shift() || "").toLowerCase();

  const { data, cfg } = await getCfg(threadsData, threadID);

  if (!sub || sub === "status") {
    return api.sendMessage(
      `📛 Auto Nickname Status\n\n` +
      `• অবস্থা: ${cfg.enabled ? "✅ চালু" : "❌ বন্ধ"}\n` +
      `• Template: ${cfg.template || "Member {firstname}"}\n\n` +
      `ব্যবহার:\n` +
      `/autonickname on\n` +
      `/autonickname off\n` +
      `/autonickname set <template>\n` +
      `/autonickname all\n` +
      `/autonickname reset`,
      threadID, messageID
    );
  }

  if (sub === "on") {
    cfg.enabled = true;
    if (!cfg.template) cfg.template = "Member {firstname}";
    await saveCfg(threadsData, threadID, data, cfg);
    return api.sendMessage(`✅ Auto nickname চালু করা হয়েছে!\n📝 Template: ${cfg.template}`, threadID, messageID);
  }

  if (sub === "off") {
    cfg.enabled = false;
    await saveCfg(threadsData, threadID, data, cfg);
    return api.sendMessage("❌ Auto nickname বন্ধ করা হয়েছে।", threadID, messageID);
  }

  if (sub === "set") {
    const template = args.join(" ").trim();
    if (!template) {
      return api.sendMessage(
        "❌ Template দাওনি!\n\nউদাহরণ:\n/autonickname set Member {firstname}\n/autonickname set 🌟 {name}",
        threadID, messageID
      );
    }
    cfg.template = template;
    await saveCfg(threadsData, threadID, data, cfg);
    return api.sendMessage(`✅ Template সেট করা হয়েছে: ${template}`, threadID, messageID);
  }

  if (sub === "all") {
    let info;
    try { info = await api.getThreadInfo(threadID); }
    catch (e) { return api.sendMessage(`❌ Group info নিতে পারিনি: ${e.message || e}`, threadID, messageID); }

    const participantIDs = (info.participantIDs || []).map(String);
    if (participantIDs.length === 0) {
      return api.sendMessage("❌ Group এ কোনো member পাওয়া যায়নি!", threadID, messageID);
    }

    const template = cfg.template || "Member {firstname}";
    const botID = String(api.getCurrentUserID());
    const nicknames = info.nicknames || {};

    let userInfo = {};
    try { userInfo = await api.getUserInfo(participantIDs); } catch (_) {}

    let success = 0, failed = 0, skipped = 0;
    await api.sendMessage(
      `⏳ ${participantIDs.length} জন member এর nickname সেট করা হচ্ছে...\n📝 Template: ${template}`,
      threadID, messageID
    );

    for (const uid of participantIDs) {
      if (uid === botID) { skipped++; continue; }
      const fullName = (userInfo[uid] && userInfo[uid].name) || "";
      const newNick = applyTemplate(template, fullName);
      if (!newNick) { skipped++; continue; }
      if (nicknames[uid] === newNick) { skipped++; continue; }
      try {
        await api.changeNickname(newNick, threadID, uid);
        success++;
      } catch (e) {
        failed++;
      }
      await new Promise(r => setTimeout(r, 800));
    }

    return api.sendMessage(
      `✅ Auto nickname সম্পন্ন!\n\n` +
      `• সফল: ${success}\n` +
      `• ব্যর্থ: ${failed}\n` +
      `• বাদ: ${skipped}`,
      threadID, messageID
    );
  }

  if (sub === "reset") {
    let info;
    try { info = await api.getThreadInfo(threadID); }
    catch (e) { return api.sendMessage(`❌ Group info নিতে পারিনি: ${e.message || e}`, threadID, messageID); }

    const participantIDs = (info.participantIDs || []).map(String);
    const botID = String(api.getCurrentUserID());

    let success = 0, failed = 0;
    await api.sendMessage(`⏳ ${participantIDs.length} জন member এর nickname মুছে ফেলা হচ্ছে...`, threadID, messageID);

    for (const uid of participantIDs) {
      if (uid === botID) continue;
      try {
        await api.changeNickname("", threadID, uid);
        success++;
      } catch (e) { failed++; }
      await new Promise(r => setTimeout(r, 800));
    }

    return api.sendMessage(
      `✅ Reset সম্পন্ন!\n\n• সফল: ${success}\n• ব্যর্থ: ${failed}`,
      threadID, messageID
    );
  }

  return api.sendMessage(
    "❌ অজানা sub-command!\n\nব্যবহার:\n/autonickname on | off | status | set <template> | all | reset",
    threadID, messageID
  );
};
