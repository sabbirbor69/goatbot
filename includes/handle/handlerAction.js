const createFuncMessage = global.utils.message;
const handlerCheckDB = require("./handlerCheckData.js");

module.exports = (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) => {
	const handlerEvents = require(process.env.NODE_ENV == 'development' ? "./handlerEvents.dev.js" : "./handlerEvents.js")(api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData);

	return async function (event) {
		// Anti-Inbox সেটিংস চেক
		if (
			global.GoatBot.config.antiInbox == true &&
			(event.senderID == event.threadID || event.userID == event.senderID || event.isGroup == false)
		)
			return;

		const message = createFuncMessage(api, event);

		// ডাটাবেজ চেক
		await handlerCheckDB(usersData, threadsData, event);
		const handlerChat = await handlerEvents(event, message);
		
		if (!handlerChat)
			return;

		const {
			onAnyEvent, onFirstChat, onStart, onChat,
			onReply, onEvent, handlerEvent, onReaction,
			typ, presence, read_receipt
		} = handlerChat;

		onAnyEvent();

		// --- গ্লোবাল টাইপিং ইন্ডিকেটর সেকশন ---
		// ইউজার মেসেজ দিলে বা রিপ্লাই দিলে এই অংশটি কাজ করবে
		if (event.type == "message" || event.type == "message_reply") {
			try {
				/** 
				 * api.sendTypingIndicator(threadID, callback, isGroup)
				 * এখানে event.isGroup পাঠানো হচ্ছে যাতে আপনার সংশোধিত sendTypingIndicator.js 
				 * দ্রুত সিদ্ধান্ত নিতে পারে এটি গ্রুপ নাকি সিঙ্গেল চ্যাট।
				 */
				api.sendTypingIndicator(event.threadID, (err) => {
					if (err) console.error("Typing Error:", err);
				}, event.isGroup);

				// ২ সেকেন্ড ডট দেখানোর জন্য ওয়েট করবে
				await new Promise(resolve => setTimeout(resolve, 2000));
			} catch (e) {
				// টাইপিং ফেল করলে বট যাতে থেমে না যায়
			}
		}
		// ------------------------------------

		// ইভেন্ট অনুযায়ী কমান্ড এক্সিকিউশন
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
