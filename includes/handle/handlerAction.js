const createFuncMessage = global.utils.message;
const handlerCheckDB = require("./handlerCheckData.js");

function isCommandMessage(event) {
	try {
		const body = (event.body || "").trim();
		if (!body) return false;
		const td = global.db?.allThreadData?.find(t => String(t.threadID) === String(event.threadID));
		const prefix = td?.data?.prefix || global.GoatBot?.config?.prefix || "/";
		return body.startsWith(prefix);
	} catch (_) { return false; }
}

module.exports = (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) => {
	const handlerEvents = require(process.env.NODE_ENV == 'development' ? "./handlerEvents.dev.js" : "./handlerEvents.js")(api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData);

	return async function (event) {
		if (
			global.GoatBot.config.antiInbox == true &&
			(event.senderID == event.threadID || event.userID == event.senderID || event.isGroup == false)
		)
			return;

		if (event.threadID && typeof event.isGroup === "boolean") {
			try {
				const tid = String(event.threadID);
				if (event.isGroup) {
					if (!global.Fca.isThread.includes(tid)) global.Fca.isThread.push(tid);
				} else {
					if (!global.Fca.isUser.includes(tid)) global.Fca.isUser.push(tid);
				}
			} catch (_) {}
		}

		const message = createFuncMessage(api, event);

		await handlerCheckDB(usersData, threadsData, event);
		const handlerChat = await handlerEvents(event, message);

		if (!handlerChat)
			return;

		const {
			onAnyEvent, onFirstChat, onStart, onChat,
			onReply, onEvent, handlerEvent, onReaction,
			typ, presence, read_receipt
		} = handlerChat;

		await onAnyEvent();

		// Only show typing indicator when the message is actually a bot command (starts with prefix)
		const isMsg = event.type == "message" || event.type == "message_reply";
		const isCommand = isMsg && isCommandMessage(event);

		if (isCommand) {
			try {
				await api.sendTypingIndicator(true, event.threadID, () => {});
				await new Promise(resolve => setTimeout(resolve, 1200));
			} catch (_) {}
		}

		try {
			switch (event.type) {
				case "message":
				case "message_reply":
				case "message_unsend":
					await onFirstChat();
					await onChat();
					await onStart();
					await onReply();
					break;
				case "event":
					await handlerEvent();
					await onEvent();
					break;
				case "message_reaction":
					await onReaction();
					break;
				case "typ":
					await typ();
					break;
				case "presence":
					await presence();
					break;
				case "read_receipt":
					await read_receipt();
					break;
				default:
					break;
			}
		} finally {
			if (isCommand) {
				try { api.sendTypingIndicator(false, event.threadID, () => {}); } catch (_) {}
			}
		}
	};
};
