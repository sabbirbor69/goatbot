const SABBIR = "Ariful Islam Sabbir";
const { getName } = require("../../utils/getName.js");

module.exports.config = {
  name: "groupevents",
  version: "1.3.0",
  role: 0,
  credits: "Ariful Islam Sabbir",
  description: "Announces all group events and refreshes bot thread memory",
  category: "Events",
  countDown: 0
};

async function refreshThreadMemory(api, threadID, threadsData) {
  try {
    const info = await api.getThreadInfo(threadID);
    if (!info) return;

    const adminIDs = (info.adminIDs || []).map(a => (a && a.id) ? String(a.id) : String(a));
    const participantIDs = (info.participantIDs || []).map(String);

    const update = {
      threadName: info.threadName || info.name || "",
      memberCount: participantIDs.length,
      adminIDs,
      members: participantIDs,
      nicknames: info.nicknames || {},
      emoji: info.emoji || "",
      imageSrc: info.imageSrc || "",
      isGroup: info.isGroup !== false
    };

    if (threadsData && typeof threadsData.refreshInfo === "function") {
      await threadsData.refreshInfo(threadID, update);
    }

    if (global.db && Array.isArray(global.db.allThreadData)) {
      const idx = global.db.allThreadData.findIndex(t => String(t.threadID) === String(threadID));
      if (idx > -1) {
        global.db.allThreadData[idx] = { ...global.db.allThreadData[idx], ...update };
      } else {
        global.db.allThreadData.push({ threadID: String(threadID), ...update, data: {}, settings: {} });
      }
    }

    // Also update isThread cache so typing indicator works correctly
    try {
      const tid = String(threadID);
      if (global.Fca && Array.isArray(global.Fca.isThread) && !global.Fca.isThread.includes(tid)) {
        global.Fca.isThread.push(tid);
      }
    } catch (_) {}
  } catch (e) {}
}

async function announce(api, threadID, lines) {
  try {
    await api.sendMessage({ body: lines.join("\n") }, threadID);
  } catch (_) {}
}

module.exports.onStart = async function ({ api, event, threadsData }) {
  const { threadID, logMessageType, logMessageData, author } = event;
  if (!logMessageType) return;

  const authorName = author ? await getName(api, author, "Someone") : "Someone";
  let lines = null;

  switch (logMessageType) {
    case "log:thread-name": {
      const newName = (logMessageData && logMessageData.name) || "New Name";
      lines = [
        "╔══ ✏️ GROUP NAME CHANGED ══╗",
        `👤 By: ${authorName}`,
        `📝 New Name: ${newName}`,
        "╚══════════════════════╝"
      ];
      await refreshThreadMemory(api, threadID, threadsData);
      break;
    }

    case "log:thread-icon": {
      const icon = (logMessageData && logMessageData.thread_icon) || "🆕";
      lines = [
        "╔══ 🎭 GROUP EMOJI CHANGED ══╗",
        `👤 By: ${authorName}`,
        `✨ New Emoji: ${icon}`,
        "╚══════════════════════╝"
      ];
      await refreshThreadMemory(api, threadID, threadsData);
      break;
    }

    case "log:thread-color": {
      const color = (logMessageData && (logMessageData.theme_color || logMessageData.color)) || "New";
      lines = [
        "╔══ 🎨 THEME CHANGED ══╗",
        `👤 By: ${authorName}`,
        `🌈 New Theme: ${color}`,
        "╚══════════════════════╝"
      ];
      await refreshThreadMemory(api, threadID, threadsData);
      break;
    }

    case "log:user-nickname": {
      const targetID = String((logMessageData && (logMessageData.participant_id || logMessageData.target)) || "");
      const botID = String(api.getCurrentUserID());
      await refreshThreadMemory(api, threadID, threadsData);
      if (targetID === botID) return;

      const newNick = (logMessageData && logMessageData.nickname) || null;
      const targetName = await getName(api, targetID, "A member");

      if (newNick) {
        lines = [
          "╔══ 📛 NICKNAME UPDATED ══╗",
          `👤 By: ${authorName}`,
          `🙍 Who: ${targetName}`,
          `✏️ New Nickname: ${newNick}`,
          "╚══════════════════════╝"
        ];
      } else {
        lines = [
          "╔══ 📛 NICKNAME REMOVED ══╗",
          `👤 By: ${authorName}`,
          `🙍 Who: ${targetName}`,
          "╚══════════════════════╝"
        ];
      }
      break;
    }

    case "log:thread-admins": {
      const targetID = logMessageData && logMessageData.target_id;
      const adminEvent = logMessageData && logMessageData.ADMIN_EVENT;
      const targetName = await getName(api, targetID, "A member");

      if (adminEvent === "add_admin") {
        lines = [
          "╔══ 🛡️ NEW ADMIN ══╗",
          `👤 By: ${authorName}`,
          `⭐ New Admin: ${targetName}`,
          "╚══════════════════════╝"
        ];
      } else if (adminEvent === "remove_admin") {
        lines = [
          "╔══ 🛡️ ADMIN REMOVED ══╗",
          `👤 By: ${authorName}`,
          `❌ Removed: ${targetName}`,
          "╚══════════════════════╝"
        ];
      }
      await refreshThreadMemory(api, threadID, threadsData);
      break;
    }

    case "log:thread-approval-mode": {
      const enabled = (logMessageData && (logMessageData.approval_mode === 1 || logMessageData.approval_mode === "1"));
      lines = [
        "╔══ 🔐 APPROVAL MODE ══╗",
        `👤 By: ${authorName}`,
        `📌 Status: ${enabled ? "✅ Enabled" : "❌ Disabled"}`,
        "╚══════════════════════╝"
      ];
      break;
    }

    case "log:thread-quick-reaction": {
      const reaction = (logMessageData && logMessageData.thread_quick_reaction) || "New";
      lines = [
        "╔══ ⚡ QUICK REACTION CHANGED ══╗",
        `👤 By: ${authorName}`,
        `💬 New Reaction: ${reaction}`,
        "╚══════════════════════╝"
      ];
      break;
    }

    case "log:subscribe":
    case "log:unsubscribe": {
      await refreshThreadMemory(api, threadID, threadsData);
      return;
    }

    default:
      return;
  }

  if (lines && lines.length > 0) {
    await announce(api, threadID, lines);
  }
};
