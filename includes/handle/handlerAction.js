const createFuncMessage = global.utils.message;
const handlerCheckDB = require("./handlerCheckData.js");

module.exports = (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) => {
	const handlerEvents = require(process.env.NODE_ENV == 'development' ? "./handlerEvents.dev.js" : "./handlerEvents.js")(api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData);

	return async function (event) {
		// Anti-Inbox এবং প্রাথমিক চেক
		if (
			global.GoatBot.config.antiInbox == true &&
			(event.senderID == event.threadID || event.userID == event.senderID || event.isGroup == false)
		)
			return;

		const message = createFuncMessage(api, event);
		await handlerCheckDB(usersData, threadsData, event);
		const handlerChat = await handlerEvents(event, message);
		if (!handlerChat) return;

		const { onAnyEvent, onFirstChat, onStart, onChat, onReply, handlerEvent, onEvent, onReaction, typ, presence, read_receipt } = handlerChat;

		onAnyEvent();

		// --- গ্লোবাল টাইপিং ইন্ডিকেটর ফিক্স ---
		if (event.type == "message" || event.type == "message_reply") {
			try {
				// টাইপিং শুরু করবে
				api.sendTypingIndicator(event.threadID); 
				// ১.৫ সেকেন্ড বিরতি যাতে ইউজার ডটগুলো দেখতে পায়
				await new Promise(res => setTimeout(res, 1500)); 
			} catch (e) {}
		}

		switch (event.type) {
			case "message":
			case "message_reply":
			case "message_unsend":
				onFirstChat();
				onChat();
				onStart();
				onReply();
				break;
			case "event":
				handlerEvent();
				onEvent();
				break;
			case "message_reaction":
				onReaction();
				break;
			case "typ":
				typ();
				break;
			case "presence":
				presence();
				break;
			case "read_receipt":
				read_receipt();
				break;
			default:
				break;
		}
	};
};
