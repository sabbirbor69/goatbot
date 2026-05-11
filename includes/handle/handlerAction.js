const createFuncMessage = global.utils.message;
const handlerCheckDB = require("./handlerCheckData.js");

module.exports = (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) => {
        const handlerEvents = require(process.env.NODE_ENV == 'development' ? "./handlerEvents.dev.js" : "./handlerEvents.js")(api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData);

        return async function (event) {
                if (
                        global.GoatBot.config.antiInbox == true &&
                        (event.senderID == event.threadID || event.userID == event.senderID || event.isGroup == false)
                )
                        return;

                // Update thread/user cache for all events that carry threadID + isGroup info.
                // This ensures sendTypingIndicator and sendMessage always know the thread type
                // even before any message has arrived from that thread.
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

                onAnyEvent();

                // Show typing indicator before processing messages, then always turn it off
                const isMsg = event.type == "message" || event.type == "message_reply";
                if (isMsg) {
                        try {
                                await api.sendTypingIndicator(true, event.threadID, () => {});
                                await new Promise(resolve => setTimeout(resolve, 1500));
                        } catch (_) {}
                }

                try {
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
                } finally {
                        // Always turn off typing after commands finish (or fail)
                        if (isMsg) {
                                try { api.sendTypingIndicator(false, event.threadID, () => {}); } catch (_) {}
                        }
                }
        };
};
