"use strict";

module.exports = function (defaultFuncs, api, ctx) {

        return async function sendTypingIndicatorV2(
                sendTyping,
                threadID,
                callback
        ) {

                if (typeof callback !== "function") {
                        callback = () => {};
                }

                try {

                        if (!ctx.mqttClient) {
                                return callback(
                                        new Error("MQTT client not found")
                                );
                        }

                        const tid = threadID.toString();

                        // Use the same authoritative isThread/isUser caches that sendMessage.js
                        // relies on. These are populated by listenMqtt.js every time a real
                        // message arrives, so they are far more reliable than the old
                        // length-based heuristic that broke on newer 15-digit Facebook IDs.
                        let isGroup;
                        if (global.Fca && Array.isArray(global.Fca.isThread) && global.Fca.isThread.includes(tid)) {
                                isGroup = 1;
                        } else if (global.Fca && Array.isArray(global.Fca.isUser) && global.Fca.isUser.includes(tid)) {
                                isGroup = 0;
                        } else {
                                // Fallback: check the live event cache
                                let liveEvt = null;
                                try {
                                        if (global.Fca && global.Fca.Data && global.Fca.Data.event &&
                                            typeof global.Fca.Data.event.get === "function") {
                                                liveEvt = global.Fca.Data.event.get("Data");
                                        }
                                } catch (_) {}

                                if (liveEvt && String(liveEvt.threadID) === tid && typeof liveEvt.isGroup === "boolean") {
                                        isGroup = liveEvt.isGroup ? 1 : 0;
                                } else {
                                        // Last resort: length heuristic (only triggers for completely unknown threads)
                                        isGroup = tid.length >= 16 ? 1 : 0;
                                }
                        }

                        const wsContent = {
                                app_id: "2220391788200892",

                                payload: JSON.stringify({
                                        label: 3,

                                        payload: JSON.stringify({
                                                thread_key: tid,
                                                is_group_thread: isGroup,
                                                is_typing: sendTyping ? 1 : 0,
                                                attribution: 0
                                        }),

                                        version: "7553237234719461"
                                }),

                                request_id: ++ctx.req_ID,

                                type: 4
                        };

                        ctx.mqttClient.publish(
                                "/ls_req",
                                JSON.stringify(wsContent),
                                {
                                        qos: 1,
                                        retain: false
                                },
                                (err) => {

                                        if (err) {
                                                console.log(err);
                                                return callback(err);
                                        }

                                        callback();
                                }
                        );

                }
                catch (e) {
                        console.log(e);
                        callback(e);
                }
        };
};
