const { getName } = require("../../utils/getName.js");
const { resolveTargets } = require("../../utils/resolveTarget.js");
const activityTracker = require("../../utils/activityTracker.js");
const { digital, header, footer, divider, relativeTime } = require("../../utils/style.js");

function isDisabledOrGenericName(n) {
  if (!n) return true;
  const s = String(n).trim().toLowerCase();
  if (!s) return true;
  return s === "facebook user"
    || s === "facebook ইউজার"
    || s.includes("facebook user")
    || s.includes("facebook ইউজার")
    || s === "messenger user"
    || s === "user";
}

if (!global.recentKicks) global.recentKicks = new Map();

module.exports.config = {
  name: "kick",
  version: "1.5.0",
  role: 1,
  hasPermssion: 1,
  credits: "Ariful Islam Sabbir",
  description: "Group theke user kick kora",
  usePrefix: true,
  category: "group",
  usages: "[@tag] / [reply] / [uid] / disable id / inactive <days>",
  countDown: 2,
  cooldowns: 0
};

function extractMentionIDs(mentions) {
  if (!mentions) return [];
  if (Array.isArray(mentions)) {
    return mentions
      .map(m => String(m && (m.id || m.userID || m) || ""))
      .filter(Boolean);
  }
  if (typeof mentions === "object") {
    return Object.keys(mentions).map(String);
  }
  return [];
}

module.exports.onStart = async function ({ api, event, args, message }) {
  const { threadID, senderID, mentions, type, messageReply } = event;

  let threadInfo;
  try {
    threadInfo = await api.getThreadInfo(threadID);
  } catch (e) {
    console.error("kick getThreadInfo:", e);
    return message.reply(`❌ Group info নিতে পারছি না\n${e.message || ""}`);
  }

  const botID = String(api.getCurrentUserID());
  const adminIDs = (threadInfo.adminIDs || []).map(a => String((a && a.id) ? a.id : a));

  if (!adminIDs.includes(botID))
    return message.reply("⚠️ Bot এই group এর admin না, তাই কাউকে kick করতে পারবে না।");

  if (!adminIDs.includes(String(senderID)))
    return message.reply("⛔ এই কাজটি শুধুমাত্র group admin করতে পারবে।");

  // ────────── /kick disable id  → kick all disabled / "Facebook User" accounts ──────────
  const subcmd = (args[0] || "").toLowerCase();
  const subcmd2 = (args[1] || "").toLowerCase();
  const isDisableMode = (subcmd === "disable" && (subcmd2 === "id" || subcmd2 === "ids"))
                     || subcmd === "disableid"
                     || subcmd === "disabledid"
                     || subcmd === "disabled";

  // ────────── /kick inactive <days> ──────────
  if (subcmd === "inactive" || subcmd === "inactives" || subcmd === "silent") {
        const days = parseInt(args[1]);
        if (!days || days < 1 || days > 365) {
                return message.reply(
                        `${header("KICK INACTIVE")}\n` +
                        `│ ⚠️ Days bolun (1-365)\n` +
                        `│ Example: /kick inactive 7\n` +
                        `${footer()}`
                );
        }

        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const userInfo = threadInfo.userInfo || [];
        const allIDs = (threadInfo.participantIDs || userInfo.map(p => p.id)).map(String);
        const byId = new Map(userInfo.map(p => [String(p.id), p]));

        const inactiveList = [];
        for (const id of allIDs) {
                if (id === botID) continue;
                if (adminIDs.includes(id)) continue;
                if (id === String(senderID)) continue;
                const lastSeen = activityTracker.getLastSeen(threadID, id);
                if (!lastSeen || lastSeen < cutoff) {
                        const p = byId.get(id);
                        inactiveList.push({
                                id,
                                name: (p && (p.name || p.firstName)) || "Unknown",
                                lastSeen: lastSeen,
                                inactiveFor: lastSeen ? (Date.now() - lastSeen) : null
                        });
                }
        }

        if (inactiveList.length === 0) {
                return message.reply(
                        `${header("KICK INACTIVE")}\n` +
                        `│ ✅ ${digital(days)} din+ inactive kau nei\n` +
                        `${footer()}`
                );
        }

        let preview = `${header("KICK INACTIVE")}\n`;
        preview += `│ 📅 Days: ${digital(days)}\n`;
        preview += `│ 🎯 Found: ${digital(inactiveList.length)} jon\n`;
        preview += `${divider()}\n`;
        const showCount = Math.min(inactiveList.length, 10);
        for (let i = 0; i < showCount; i++) {
                const u = inactiveList[i];
                const last = u.inactiveFor ? `${relativeTime(u.inactiveFor)} ago` : "never tracked";
                preview += `│ ${digital(i + 1)}. ${u.name} — ${last}\n`;
        }
        if (inactiveList.length > 10) preview += `│ ... +${digital(inactiveList.length - 10)} more\n`;
        preview += `${divider()}\n│ ⏳ Kick shuru hocche...\n${footer()}`;
        await message.reply(preview);

        let success = 0, failed = 0;
        for (const u of inactiveList) {
                try {
                        await api.removeUserFromGroup(u.id, threadID);
                        global.recentKicks.set(`${threadID}_${u.id}`, Date.now());
                        success++;
                } catch (e) {
                        console.error(`[kick inactive] failed ${u.id}:`, e?.message || e);
                        failed++;
                }
                await new Promise(r => setTimeout(r, 800));
        }

        return api.sendMessage(
                `${header("INACTIVE KICK DONE")}\n` +
                `│ ✅ Success: ${digital(success)}\n` +
                `│ ❌ Failed:  ${digital(failed)}\n` +
                `│ 📊 Total:   ${digital(inactiveList.length)}\n` +
                `│ 📅 Cutoff:  ${digital(days)} din\n` +
                `${footer()}`,
                threadID
        );
  }
  // ────────── End /kick inactive ──────────

  if (isDisableMode) {
    const userInfo = threadInfo.userInfo || [];
    const allIDs = (threadInfo.participantIDs || userInfo.map(p => p.id)).map(String);
    const byId = new Map(userInfo.map(p => [String(p.id), p]));

    // Build candidate disabled IDs (generic name OR no name at all)
    const disabledIDs = [];
    for (const id of allIDs) {
      if (id === botID) continue;
      if (adminIDs.includes(id)) continue;
      if (id === String(senderID)) continue;
      const p = byId.get(id);
      const name = p ? (p.name || p.firstName || "") : "";
      if (isDisabledOrGenericName(name)) disabledIDs.push(id);
    }

    if (disabledIDs.length === 0) {
      return message.reply("✅ Ei group e kono disabled / Facebook User account paini. Shob member er real name ache.");
    }

    await message.reply(`🔍 ${disabledIDs.length} ti disabled/Facebook User account paoa gechhe. Kick shuru hocche...`);

    let success = 0, failed = 0;
    for (const id of disabledIDs) {
      try {
        await api.removeUserFromGroup(id, threadID);
        global.recentKicks.set(`${threadID}_${id}`, Date.now());
        success++;
      } catch (e) {
        console.error(`[kick disable id] failed for ${id}:`, e?.message || e);
        failed++;
      }
      await new Promise(r => setTimeout(r, 800));
    }

    return api.sendMessage(
      `👢 Disable ID kick complete!\n\n` +
      `✅ Success: ${success}\n` +
      `❌ Failed: ${failed}\n` +
      `📊 Total found: ${disabledIDs.length}`,
      threadID
    );
  }
  // ────────── End /kick disable id ──────────

  const result = await resolveTargets({ api, event, args });

  if (result.ambiguous) {
    let text = `⚠️ "${result.query}" — eki rokom name er ekadhik jon paoa gechhe. Specific kore din:\n\n`;
    result.candidates.forEach((c, i) => {
      text += `${i + 1}. ${c.name || "(no name)"} — 🔢 ${c.uid}\n`;
    });
    text += `\nUID diye abar /kick chalan, eg:\n/kick ${result.candidates[0].uid}`;
    return message.reply(text.trim());
  }

  let targets = result.targets.map(r => r.uid);

  if (targets.length === 0) {
    if (result.error) return message.reply(`❌ Group info ana jaai ni: ${result.error}`);
    if (result.query) {
      let msg = `❌ "${result.query}" name er kau ke group e paini.`;
      if (result.available && result.available.length > 0) {
        msg += `\n\n📋 Group e ${result.totalParticipants} jon ache. Kichu name (UID shoho):\n`;
        result.available.forEach((c, i) => { msg += `${i + 1}. ${c.name} — 🔢 ${c.uid}\n`; });
        msg += `\nTry koro: /kick <UID>`;
      } else {
        msg += ` Real @mention, reply, ba direct UID use korun.`;
      }
      return message.reply(msg.trim());
    }
    return message.reply("📌 ব্যবহার:\n• /kick @mention\n• /kick @name (group member er name)\n• Reply দিয়ে /kick\n• /kick <UID>");
  }

  for (const id of targets) {
    const sid = String(id);

    if (sid === botID) {
      await message.reply("🙃 আমি নিজেকে kick করতে পারব না!");
      continue;
    }

    if (adminIDs.includes(sid)) {
      const aname = await getName(api, sid, "একজন admin");
      await message.reply(`🛡️ ${aname} group admin, তাকে kick করা যাবে না।`);
      continue;
    }

    const name = await getName(api, sid, "এই user");

    global.recentKicks.set(`${threadID}_${sid}`, Date.now());

    try {
      await api.removeUserFromGroup(sid, threadID);
      await api.sendMessage(`👢 ${name} কে group থেকে বের করে দেওয়া হয়েছে!`, threadID);
    } catch (kerr) {
      global.recentKicks.delete(`${threadID}_${sid}`);
      console.error("kick failed:", kerr);
      await api.sendMessage(`❌ ${name} কে kick করা যায়নি!\n${kerr.message || kerr.error || ""}`, threadID);
    }

    await new Promise(r => setTimeout(r, 600));
  }
};
