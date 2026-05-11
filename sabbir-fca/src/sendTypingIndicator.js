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

			const wsContent = {
				app_id: "2220391788200892",

				payload: JSON.stringify({
					label: 3,

					payload: JSON.stringify({
						thread_key: threadID.toString(),

						is_group_thread:
							threadID.toString().length >= 16 ? 1 : 0,

						is_typing: sendTyping ? 1 : 0,

						attribution: 0
					}),

					version: "5849951561777440"
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
