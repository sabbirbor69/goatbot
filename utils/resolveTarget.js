async function resolveTargets({ api, event }) {
	const { mentions, senderID, messageReply, threadID, body } = event;

	// =========================
	// 1. Real FB Mention Detect
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
				name: mentions[uid]
					? mentions[uid].replace(/^@/, "").trim()
					: null,
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
	// 3. Text Name Detect
	// =========================
	const args = (body || "").trim().split(/\s+/);

	const nameQuery = args
		.slice(1)
		.join(" ")
		.replace(/^@/, "")
		.toLowerCase()
		.trim();

	// কিছু না লিখলে নিজের UID
	if (!nameQuery) {
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

		const matched = (threadInfo.userInfo || []).find(user =>
			user.name &&
			user.name.toLowerCase().includes(nameQuery)
		);

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

		return {
			error: true,
			message: `❌ User "${nameQuery}" not found.`
		};

	} catch (e) {
		console.log(e);

		return {
			error: true,
			message: "❌ Failed to fetch thread info."
		};
	}
}

module.exports = {
	resolveTargets
};
