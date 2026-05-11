module.exports.config = {
        name: "groups",
        version: "1.0.0",
        hasPermssion: 0,
        credits: "Ariful Islam Sabbir",
        description: "Bot je shob group e ache tar list / specific group er detail (members, admins) dekhabe",
        usePrefix: true,
        category: "Info",
        usages: "groups | groups <number> | groups info <threadID> | groups members <threadID> | groups admins <threadID>",
        cooldowns: 5
};

function getThreadListSafe(api) {
        return new Promise((resolve, reject) => {
                try {
                        api.getThreadList(100, null, ["INBOX"], (err, list) => {
                                if (err) return reject(err);
                                resolve(Array.isArray(list) ? list : []);
                        });
                } catch (e) {
                        reject(e);
                }
        });
}

function getThreadInfoSafe(api, threadID) {
        return new Promise((resolve, reject) => {
                try {
                        api.getThreadInfo(threadID, (err, info) => {
                                if (err) return reject(err);
                                resolve(info);
                        });
                } catch (e) {
                        reject(e);
                }
        });
}

function getNamesByIds(api, ids) {
        return new Promise((resolve) => {
                if (!ids || ids.length === 0) return resolve({});
                try {
                        api.getUserInfo(ids, (err, info) => {
                                if (err || !info) return resolve({});
                                resolve(info);
                        });
                } catch (e) {
                        resolve({});
                }
        });
}

async function listGroups(api, message) {
        let list;
        try {
                list = await getThreadListSafe(api);
        } catch (e) {
                return message.reply("❌ Group list ana jaai ni: " + (e?.message || e));
        }
        const groups = list.filter(t => t && t.isGroup);
        if (groups.length === 0) return message.reply("ℹ️ Bot ekhono kono group e nai.");

        let out = `📋 Bot total ${groups.length} ta group e ache:\n\n`;
        groups.slice(0, 50).forEach((g, i) => {
                const name = g.name || g.threadName || "(no name)";
                const count = g.participantIDs ? g.participantIDs.length : (g.userInfo ? g.userInfo.length : "?");
                out += `${i + 1}. ${name}\n   🆔 ${g.threadID}\n   👥 ${count} members\n\n`;
        });
        out += `\n📝 Detail dekhte: ${global.GoatBot?.config?.prefix || "/"}groups info <threadID>`;
        return message.reply(out);
}

async function showGroupInfo(api, message, threadID, mode) {
        let info;
        try {
                info = await getThreadInfoSafe(api, threadID);
        } catch (e) {
                return message.reply("❌ Group info ana jaai ni: " + (e?.message || e));
        }
        if (!info) return message.reply("❌ Ei thread er info paini.");

        const adminIDs = (info.adminIDs || []).map(a => (typeof a === "object" ? a.id : a));
        const participants = info.userInfo || [];
        const allIDs = info.participantIDs || participants.map(p => p.id);

        // Build name map
        const nameMap = {};
        participants.forEach(p => { if (p && p.id) nameMap[p.id] = p.name || p.firstName || p.id; });
        const missing = allIDs.filter(id => !nameMap[id]);
        if (missing.length) {
                const fetched = await getNamesByIds(api, missing.slice(0, 50));
                Object.keys(fetched).forEach(id => { nameMap[id] = fetched[id].name || id; });
        }

        if (mode === "members") {
                let out = `👥 ${info.threadName || info.name || threadID} - Members (${allIDs.length}):\n\n`;
                allIDs.slice(0, 80).forEach((id, i) => {
                        const star = adminIDs.includes(id) ? " 👑" : "";
                        out += `${i + 1}. ${nameMap[id] || id}${star}\n   🆔 ${id}\n`;
                });
                if (allIDs.length > 80) out += `\n... aro ${allIDs.length - 80} jon ache.`;
                return message.reply(out);
        }

        if (mode === "admins") {
                let out = `👑 ${info.threadName || info.name || threadID} - Admins (${adminIDs.length}):\n\n`;
                adminIDs.forEach((id, i) => {
                        out += `${i + 1}. ${nameMap[id] || id}\n   🆔 ${id}\n`;
                });
                if (adminIDs.length === 0) out += "(kono admin info paini)";
                return message.reply(out);
        }

        // Default: full info
        let out = `📌 GROUP INFO\n`;
        out += `━━━━━━━━━━━━━━━\n`;
        out += `📛 Name: ${info.threadName || info.name || "(no name)"}\n`;
        out += `🆔 Thread ID: ${threadID}\n`;
        out += `👥 Total Members: ${allIDs.length}\n`;
        out += `👑 Total Admins: ${adminIDs.length}\n`;
        if (info.emoji) out += `😀 Emoji: ${info.emoji}\n`;
        if (info.color) out += `🎨 Color: ${info.color}\n`;
        if (info.imageSrc) out += `🖼 Image: ${info.imageSrc}\n`;
        if (info.approvalMode !== undefined) out += `🔒 Approval Mode: ${info.approvalMode ? "ON" : "OFF"}\n`;
        out += `━━━━━━━━━━━━━━━\n\n`;

        out += `👑 ADMINS (${adminIDs.length}):\n`;
        adminIDs.slice(0, 20).forEach((id, i) => {
                out += `  ${i + 1}. ${nameMap[id] || id} (${id})\n`;
        });
        if (adminIDs.length > 20) out += `  ... aro ${adminIDs.length - 20} jon\n`;

        out += `\n👥 MEMBERS (${allIDs.length}):\n`;
        allIDs.slice(0, 30).forEach((id, i) => {
                const star = adminIDs.includes(id) ? " 👑" : "";
                out += `  ${i + 1}. ${nameMap[id] || id}${star}\n`;
        });
        if (allIDs.length > 30) out += `  ... aro ${allIDs.length - 30} jon. Full list dekhte: ${global.GoatBot?.config?.prefix || "/"}groups members ${threadID}\n`;

        return message.reply(out);
}

module.exports.onStart = async function ({ api, message, event, args }) {
        try {
                const sub = (args[0] || "").toLowerCase();

                if (!sub) return await listGroups(api, message);

                if (sub === "info" || sub === "members" || sub === "admins") {
                        const tid = args[1] || event.threadID;
                        if (!tid) return message.reply(`Thread ID din. Example: ${global.GoatBot?.config?.prefix || "/"}groups ${sub} <threadID>`);
                        const mode = sub === "info" ? null : sub;
                        return await showGroupInfo(api, message, String(tid), mode);
                }

                // Numeric sub: show info of N-th group from list
                if (/^\d+$/.test(sub)) {
                        const n = parseInt(sub, 10);
                        const list = await getThreadListSafe(api);
                        const groups = list.filter(t => t && t.isGroup);
                        if (n < 1 || n > groups.length) return message.reply(`❌ Group number 1 theke ${groups.length} er moddhe din.`);
                        return await showGroupInfo(api, message, String(groups[n - 1].threadID), null);
                }

                return message.reply(
                        `Usage:\n` +
                        `• ${global.GoatBot?.config?.prefix || "/"}groups — sob group er list\n` +
                        `• ${global.GoatBot?.config?.prefix || "/"}groups <number> — list er N-th group er detail\n` +
                        `• ${global.GoatBot?.config?.prefix || "/"}groups info <threadID> — specific group er detail\n` +
                        `• ${global.GoatBot?.config?.prefix || "/"}groups members <threadID> — full member list\n` +
                        `• ${global.GoatBot?.config?.prefix || "/"}groups admins <threadID> — admin list`
                );
        } catch (err) {
                return message.reply("❌ Error: " + (err?.message || err));
        }
};

module.exports.run = module.exports.onStart;
