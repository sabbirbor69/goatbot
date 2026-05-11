const fs = require("fs-extra");
const path = require("path");

module.exports = async (api, event, logger, getText) => {

	try {

		const commandPath = path.join(
			__dirname,
			"../scripts/cmds"
		);

		if (!fs.existsSync(commandPath))
			return;

		const body = (event.body || "").trim();

		if (!body)
			return;

		const prefix =
			global.GoatBot?.config?.prefix || "/";

		let commandName = body
			.split(/\s+/)[0]
			.toLowerCase();

		if (commandName.startsWith(prefix)) {
			commandName = commandName.slice(
				prefix.length
			);
		}

		const args = body
			.split(/\s+/)
			.slice(1);

		const commandFiles = fs
			.readdirSync(commandPath)
			.filter(file =>
				file.endsWith(".js")
			);

		for (const file of commandFiles) {

			delete require.cache[
				require.resolve(
					path.join(commandPath, file)
				)
			];

			const command = require(
				path.join(commandPath, file)
			);

			if (
				!command.config ||
				!command.config.name
			)
				continue;

			const cmdName =
				command.config.name.toLowerCase();

			if (cmdName === commandName) {

				// noPrefix support
				if (
					!body.startsWith(prefix) &&
					command.config.noPrefix !== true
				) {
					return;
				}

				try {

					// ====================
					// TYPING ON
					// ====================

					try {

						await api.sendTypingIndicator(
							true,
							event.threadID
						);

					}
					catch (_) {}

					// typing visible delay
					await new Promise(resolve =>
						setTimeout(resolve, 2000)
					);

					// ====================
					// GOATBOT STYLE
					// ====================

					if (
						typeof command.onStart ===
						"function"
					) {

						await command.onStart({

							api,
							event,
							args,
							logger,
							getText,

							message: {

								reply: (msg) =>
									api.sendMessage(
										msg,
										event.threadID,
										event.messageID
									),

								send: (msg) =>
									api.sendMessage(
										msg,
										event.threadID
									)
							}
						});
					}

					// ====================
					// TYPING OFF
					// ====================

					try {

						await api.sendTypingIndicator(
							false,
							event.threadID
						);

					}
					catch (_) {}

					return;

				}
				catch (e) {

					console.log(e);

					// typing OFF on error
					try {

						await api.sendTypingIndicator(
							false,
							event.threadID
						);

					}
					catch (_) {}

					logger?.(

						getText?.(
							"system.commandError",
							file
						) ||

						`Command Error: ${file}`,

						"ERROR"
					);

					api.sendMessage(

						"❌ Command Error!",

						event.threadID,
						event.messageID
					);

				}
			}
		}

	}
	catch (e) {
		console.log(e);
	}
};
