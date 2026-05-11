function normalize(s) {
	return String(s || "")
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function extractMentionIDs(mentions, excludeIDs) {
	const exclude = new Set((excludeIDs || []).map(String));
	if (!mentions) return [];
	if (Array.isArray(mentions)) {
		return mentions
			.map(m => String(m && (m.id || m.userID || m) || ""))
			.filter(id => id && !exclude.has(id));
	}
	if (typeof mentions === "object") {
		return Object.keys(mentions)
			.map(String)
			.filter(id => id && id !== "null" && !exclude.has(id));
	}
	return [];
}

function scoreParticipants(participants, query, excludeIDs) {
	if (!query || !participants || !participants.length) return [];
	const exclude = new Set((excludeIDs || []).map(String));
	const nq = normalize(query.replace(/^@+/, ""));
	if (!nq) return [];
	const qwords = nq.split(" ").filter(Boolean);
	if (qwords.length === 0) return [];

	const scored = [];
	for (const p of participants) {
		if (!p || !p.id || exclude.has(String(p.id))) continue;
		const pname = normalize(p.name || p.firstName || "");
		if (!pname) continue;
		const pwords = pname.split(" ").filter(Boolean);

		let score = 0;
		let wordsHit = 0;

		if (pname === nq) { score = 100000; wordsHit = qwords.length; }
		else if (pname.includes(nq)) { score = 50000 + nq.length * 10; wordsHit = qwords.length; }
		else if (nq.includes(pname) && pname.length >= 3) { score = 30000 + pname.length * 10; wordsHit = qwords.length; }
		else {
			for (const w of qwords) {
				if (!w || w.length < 2) continue;
				let best = 0;
				for (const pw of pwords) {
					if (pw === w) best = Math.max(best, 100);
					else if (pw.startsWith(w) && w.length >= 3) best = Math.max(best, 60);
					else if (w.startsWith(pw) && pw.length >= 3) best = Math.max(best, 50);
					else if (pw.includes(w) && w.length >= 3) best = Math.max(best, 30);
					else if (w.includes(pw) && pw.length >= 3) best = Math.max(best, 20);
				}
				if (best > 0) wordsHit++;
				score += best;
			}
		}

		if (score > 0) scored.push({ p, score, wordsHit, totalWords: qwords.length });
	}

	scored.sort((a, b) => b.score - a.score);
	return scored;
}

function isGenericName(n) {
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

async function enrichParticipants(api, threadInfo) {
	// Guard: if threadInfo is null/undefined, return empty list instead of crashing
	if (!threadInfo) return [];

	const participants = (threadInfo.userInfo || []).slice();
	const allIDs = threadInfo.participantIDs || participants.map(p => p.id);

	const haveRealNames = new Set(
		participants
			.filter(p => p && (p.name || p.firstName) && !isGenericName(p.name || p.firstName))
			.map(p => String(p.id))
	);
	const needIDs = (allIDs || []).map(String).filter(id => !haveRealNames.has(id));

	if (needIDs.length === 0) return participants;

	try {
		const fetched = await new Promise((resolve, reject) => {
			api.getUserInfo(needIDs.slice(0, 100), (err, info) => err ? reject(err) : resolve(info || {}));
		});
		const byId = new Map(participants.map(p => [String(p.id), p]));
		for (const id of Object.keys(fetched)) {
			const u = fetched[id];
			if (!u) continue;
			const newName = u.name || u.firstName;
			if (!newName) continue;
			const existing = byId.get(String(id));
			if (existing) {
				if (isGenericName(existing.name) && !isGenericName(newName)) {
					existing.name = newName;
				}
				if (!existing.firstName && u.firstName) existing.firstName = u.firstName;
			} else {
				participants.push({ id: String(id), name: newName, firstName: u.firstName });
			}
		}
	} catch (e) { /* ignore */ }

	return participants;
}

async function resolveTargets({ api, event, args, includeSelfFromMention = false, includeBot = false }) {
	const { mentions, senderID, messageReply, threadID, body } = event;
	const botID = String(api.getCurrentUserID());
	const exclude = [];
	if (!includeBot) exclude.push(botID);
	if (!includeSelfFromMention) exclude.push(String(senderID));

	// 1) Real FB mentions
	const mentionIDs = extractMentionIDs(mentions, exclude);
	if (mentionIDs.length > 0) {
		return {
			targets: mentionIDs.map(uid => ({
				uid,
				name: (mentions[uid] || "").replace(/^@/, "").trim() || null,
				source: "mention"
			})),
			ambiguous: false
		};
	}

	// 2) Reply
	if (messageReply && messageReply.senderID) {
		return {
			targets: [{ uid: String(messageReply.senderID), name: null, source: "reply" }],
			ambiguous: false
		};
	}

	// 3) Numeric UID args
	const uidArgs = (args || []).filter(a => /^\d{5,}$/.test(String(a)));
	if (uidArgs.length > 0) {
		return {
			targets: uidArgs.map(u => ({ uid: String(u), name: null, source: "uid" })),
			ambiguous: false
		};
	}

	// 4) Name search across thread participants
	const rawArgs = (args && args.length) ? args : ((body || "").trim().split(/\s+/).slice(1));
	const nameQuery = rawArgs.join(" ").trim();
	if (!nameQuery) return { targets: [], ambiguous: false };

	let participants;
	try {
		const info = await api.getThreadInfo(threadID);
		participants = await enrichParticipants(api, info);
	} catch (e) {
		return { targets: [], ambiguous: false, error: e.message || String(e), query: nameQuery };
	}

	console.log(`[resolveTargets] query="${nameQuery}" | participants=${participants.length} | sample names: ${participants.slice(0, 5).map(p => `"${p.name || p.firstName || "(no-name)"}"`).join(", ")}`);

	let ranked = scoreParticipants(participants, nameQuery, exclude);

	if (ranked.length === 0) {
		const nq = normalize(nameQuery.replace(/^@+/, ""));
		const qwords = nq.split(" ").filter(w => w.length >= 2);
		const loose = [];
		const excSet = new Set(exclude.map(String));
		for (const p of participants) {
			if (!p || !p.id || excSet.has(String(p.id))) continue;
			const pname = normalize(p.name || p.firstName || "");
			if (!pname) continue;
			let s = 0;
			for (const w of qwords) {
				if (pname.includes(w)) s += w.length;
				else if (w.includes(pname) && pname.length >= 3) s += pname.length;
			}
			if (s > 0) loose.push({ p, score: s, wordsHit: 1, totalWords: qwords.length });
		}
		loose.sort((a, b) => b.score - a.score);
		ranked = loose;
	}

	if (ranked.length === 0) {
		const sample = participants
			.filter(p => p && p.id && !exclude.includes(String(p.id)))
			.slice(0, 15)
			.map(p => ({
				uid: String(p.id),
				name: p.name || p.firstName || "(no name visible to bot)"
			}));
		return { targets: [], ambiguous: false, query: nameQuery, available: sample, totalParticipants: participants.length };
	}

	const top = ranked[0];
	const second = ranked[1];
	const dominant = !second || top.score >= second.score * 1.6 || (top.wordsHit === top.totalWords && top.score >= 100);

	if (dominant && top.score >= 30) {
		return {
			targets: [{
				uid: String(top.p.id),
				name: top.p.name || null,
				source: "name"
			}],
			ambiguous: false
		};
	}

	const tied = ranked.filter(r => r.score >= top.score * 0.6).slice(0, 5);
	return {
		targets: [],
		ambiguous: true,
		query: nameQuery,
		candidates: tied.map(t => ({
			uid: String(t.p.id),
			name: t.p.name || null,
			score: t.score
		}))
	};
}

module.exports = { resolveTargets, extractMentionIDs, scoreParticipants, normalize };
