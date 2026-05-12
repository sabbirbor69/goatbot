const fs = require("fs-extra");

function normalize(s) {
	return String(s || "")
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

async function resolveTargets({ api, event, args = [] }) {
	const { mentions, senderID, messageReply, threadID, body } = event;

	// =========================
	// 1. Mention Detect
	// =========================
	const mentionIDs = mentions && typeof mentions === "object"
		? Object.keys(mentions).filter(
			id => id && id !== "null" && id !== senderID
		)
		: [];

	if (mentionIDs.length > 0) {
		return {
			targets: mentionIDs.map(uid => ({
				uid: String(uid),
				name: mentions[uid]?.replace(/^@/, "") || null,
				source: "mention"
			})),
			ambiguous: false
		};
	}

	// =========================
	// 2. Reply Detect
	// =========================
	if (messageReply && messageReply.senderID) {
		return {
			targets: [{
				uid: String(messageReply.senderID),
				name: null,
				source: "reply"
			}],
			ambiguous: false
		};
	}

	// =========================
	// 3. UID Detect
	// =========================
	const uidArgs = (args || []).filter(a =>
		/^\d{5,}$/.test(String(a))
	);

	if (uidArgs.length > 0) {
		return {
			targets: uidArgs.map(uid => ({
				uid: String(uid),
				name: null,
				source: "uid"
			})),
			ambiguous: false
		};
	}

	// =========================
	// 4. Name Detect
	// =========================
	const rawArgs = args.length
		? args
		: (body || "").trim().split(/\s+/).slice(1);

	const query = rawArgs.join(" ").trim();

	if (!query) {
		return {
			targets: [{
				uid: String(senderID),
				name: null,
				source: "self"
			}],
			ambiguous: false
		};
	}

	try {
		const threadInfo = await api.getThreadInfo(threadID);

		const participants = threadInfo.userInfo || [];

		const nq = normalize(query);

		const matched = participants.find(user => {
			const uname = normalize(user.name || user.firstName || "");
			return uname.includes(nq);
		});

		if (matched) {
			return {
				targets: [{
					uid: String(matched.id),
					name: matched.name || null,
					source: "name"
				}],
				ambiguous: false
			};
		}

	} catch (e) {
		console.log(e);
	}

	// =========================
	// 5. Default Self
	// =========================
	return {
		targets: [{
			uid: String(senderID),
			name: null,
			source: "self"
		}],
		ambiguous: false
	};
}

module.exports = {
	resolveTargets
};
