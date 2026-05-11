const { getName } = require("../../utils/getName.js");

module.exports.config = {
  name: "groupevents",
  version: "1.4.0",
  role: 0,
  credits: "Ariful Islam Sabbir",
  description: "Announces all group events and refreshes bot thread memory",
  category: "Events",
  countDown: 0
};

function patchAdminInMemory(threadID, targetID, adminEvent) {
  try {
    if (!targetID || !global.db || !Array.isArray(global.db.allThreadData)) return;
    const thread = global.db.allThreadData.find(t => String(t.threadID) === String(threadID));
    if (!thread) return;
    if (!Array.isArray(thread.adminIDs)) thread.adminIDs = [];
    const id = String(targetID);
    if (adminEvent === "add_admin") {
      if (!thread.adminIDs.some(a => String(a.id || a) === id))
        thread.adminIDs.push(id);
    } else if (adminEvent === "remove_admin") {
      thread.adminIDs = thread.adminIDs.filter(a => String(a.id || a) !== id);
    }
  } catch (_) {}
}

function patchMembersInMemory(threadID, addedIDs, removedID) {
  try {
    if (!global.db || !Array.isArray(global.db.allThreadData)) return;
    const thread = global.db.allThreadData.find(t => String(t.threadID) === String(threadID));
    if (!thread) return;
    if (!Array.isArray(thread.members)) thread.members = [];
    if (addedIDs && addedIDs.length > 0) {
      for (const uid of addedIDs) {
        const id = String(uid);
        if (!thread.members.includes(id)) thread.members.push(id);
      }
      thread.memberCount = thread.members.length;
    }
    if (removedID) {
      const id = String(removedID);
      thread.members = thread.members.filter(m => String(m) !== id);
      thread.memberCount = thread.members.length;
      thread.adminIDs = (thread.adminIDs || []).filter(a => String(a.id || a) !== id);
    }
  } catch (_) {}
}

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
    try {
      const tid = String(threadID);
      if (global.Fca && Array.isArray(global.Fca.isThread) && !global.Fca.isThread.includes(tid))
        global.Fca.isThread.push(tid);
    } catch (_) {}
  } catch (_) {}
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

    case "log:subscribe": {
      const addedIDs = (logMessageData && logMessageData.addedParticipants || [])
        .map(p => String(p.userFbId || p.userId || p.id || "").replace(/^fbid:/, ""))
        .filter(Boolean);
      patchMembersInMemory(threadID, addedIDs, null);
      refreshThreadMemory(api, threadID, threadsData).catch(() => {});
      return;
    }

    case "log:unsubscribe": {
      const removedID = logMessageData &&
        String(logMessageData.leftParticipantFbId || logMessageData.leftParticipantUserId || "")
          .replace(/^fbid:/, "");
      if (removedID) patchMembersInMemory(threadID, null, removedID);
      refreshThreadMemory(api, threadID, threadsData).catch(() => {});
      return;
    }

    case "log:thread-name": {
      const newName = (logMessageData && logMessageData.name) || "New Name";
      lines = [
        "╔══ ✏️ GROUP NAME CHANGED ══╗",
        `👤 By: ${authorName}`,
        `📝 New Name: ${newName}`,
        "╚══════════════════════╝"
      ];
      try {
        const thread = global.db.allThreadData.find(t => String(t.threadID) === String(threadID));
        if (thread) thread.threadName = newName;
      } catch (_) {}
      refreshThreadMemory(api, threadID, threadsData).catch(() => {});
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
      refreshThreadMemory(api, threadID, threadsData).catch(() => {});
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
      refreshThreadMemory(api, threadID, threadsData).catch(() => {});
      break;
    }

    case "log:user-nickname": {
      const targetID = String((logMessageData && (logMessageData.participant_id || logMessageData.target)) || "");
      const botID = String(api.getCurrentUserID());
      refreshThreadMemory(api, threadID, threadsData).catch(() => {});
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
      const targetID = String(
        (logMessageData && (logMessageData.TARGET_ID || logMessageData.target_id || logMessageData.targetId || logMessageData.target)) || ""
      ).replace(/^fbid:/, "");
      const adminEvent = logMessageData && (logMessageData.ADMIN_EVENT || logMessageData.admin_event);

      patchAdminInMemory(threadID, targetID, adminEvent);
      refreshThreadMemory(api, threadID, threadsData).catch(() => {});

      const targetName = targetID ? await getName(api, targetID, "A member") : "A member";
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

    default:
      return;
  }

  if (lines && lines.length > 0) {
    await announce(api, threadID, lines);
  }
};
