const fs = require("fs-extra");
const path = require("path");

module.exports = async (api, event, logger, getText) => {
	try {
		const commandPath = path.join(__dirname, "../scripts/cmds");

		// command folder check
		if (!fs.existsSync(commandPath)) return;

		const body = (event.body || "").trim();

		// empty message ignore
		if (!body) return;

		const prefix = global.GoatBot?.config?.prefix || "/";

		let commandName = body.split(/\s+/)[0].toLowerCase();

		// remove prefix
		if (commandName.startsWith(prefix)) {
			commandName = commandName.slice(prefix.length);
		}

		const args = body.split(/\s+/).slice(1);

		const commandFiles = fs
			.readdirSync(commandPath)
			.filter(file => file.endsWith(".js"));

		for (const file of commandFiles) {

			// hot reload
			delete require.cache[
				require.resolve(path.join(commandPath, file))
			];

			const command = require(path.join(commandPath, file));

			// invalid command skip
			if (!command.config || !command.config.name)
				continue;

			const cmdName = command.config.name.toLowerCase();

			// command matched
			if (cmdName === commandName) {

				// noPrefix support
				if (
					!body.startsWith(prefix) &&
					command.config.noPrefix !== true
				) {
					return;
				}

				try {

					// typing indicator
					try {
						if (typeof api.sendTypingIndicator === "function") {
							api.sendTypingIndicator(
								event.threadID,
								() => {},
								event.isGroup
							);
						}
					}
					catch (_) {}

					// GoatBot style
					if (typeof command.onStart === "function") {

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

					// Mirai style fallback
					else if (typeof command.run === "function") {

						await command.run({
							api,
							event,
							args,
							logger,
							getText
						});
					}

					return;
				}
				catch (e) {

					console.log(e);

					logger?.(
						getText?.("system.commandError", file) ||
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
