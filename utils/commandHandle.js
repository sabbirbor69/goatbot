const fs = require("fs-extra");
const path = require("path");

module.exports = async (api, event, logger, getText) => {
	try {
		const commandPath = path.join(__dirname, "../scripts/cmds");

		if (!fs.existsSync(commandPath)) return;

		const body = (event.body || "").trim();

		if (!body) return;

		const prefix = global.GoatBot?.config?.prefix || "/";

		let commandName = body.split(/\s+/)[0].toLowerCase();

		// prefix remove
		if (commandName.startsWith(prefix)) {
			commandName = commandName.slice(prefix.length);
		}

		const args = body.split(/\s+/).slice(1);

		const commandFiles = fs
			.readdirSync(commandPath)
			.filter(file => file.endsWith(".js"));

		for (const file of commandFiles) {
			delete require.cache[require.resolve(path.join(commandPath, file))];

			const command = require(path.join(commandPath, file));

			if (!command.config || !command.config.name) continue;

			const cmdName = command.config.name.toLowerCase();

			// normal command
			if (cmdName === commandName) {

				// noPrefix support
				if (
					!body.startsWith(prefix) &&
					command.config.noPrefix !== true
				) return;

				try {
					if (typeof command.onStart === "function") {
						return await command.onStart({
							api,
							event,
							args,
							logger,
							getText,
							message: {
								reply: (msg) =>
									api.sendMessage(msg, event.threadID, event.messageID)
							}
						});
					}

					// mirai style fallback
					if (typeof command.run === "function") {
						return await command.run({
							api,
							event,
							args,
							logger,
							getText
						});
					}
				}
				catch (e) {
					console.log(e);
					logger?.(
						getText?.("system.commandError", file) ||
						`Command Error: ${file}`,
						"ERROR"
					);
				}
			}
		}
	}
	catch (e) {
		console.log(e);
	}
};
