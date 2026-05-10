/**
 * GOAT-BOT: handler.js
 * Auto command + event loader
 * Fixed By Ariful Islam Sabbir
 */

const fs = require("fs");
const path = require("path");
const logger = require("./logger");

module.exports = (client) => {

	// ================= COMMANDS ================= //

	client.commands = new Map();

	const commandsPath =
		path.join(__dirname, "../commands");

	if (!fs.existsSync(commandsPath)) {

		logger.warn(
			"commands folder পাওয়া যায়নি"
		);

		return;
	}

	const commandFiles =
		fs.readdirSync(commandsPath)
		.filter(file => file.endsWith(".js"));

	for (const file of commandFiles) {

		try {

			const filePath =
				path.join(commandsPath, file);

			delete require.cache[
				require.resolve(filePath)
			];

			const command =
				require(filePath);

			// GoatBot style support
			const cmdName =
				command?.config?.name ||
				command?.name;

			const runFunc =
				command?.onStart ||
				command?.execute;

			if (cmdName && runFunc) {

				client.commands.set(
					cmdName,
					command
				);

				logger.info(
					`Loaded command: ${cmdName}`
				);

			} else {

				logger.warn(
					`Load failed: ${file}`
				);
			}

		} catch (e) {

			logger.error(
				`Command Error (${file})`,
				e
			);
		}
	}

	logger.info(
		`${client.commands.size}টি command load হয়েছে`
	);

	// ================= EVENTS ================= //

	const eventsPath =
		path.join(__dirname, "../events");

	if (!fs.existsSync(eventsPath)) {

		logger.warn(
			"events folder পাওয়া যায়নি"
		);

		return;
	}

	const eventFiles =
		fs.readdirSync(eventsPath)
		.filter(file => file.endsWith(".js"));

	for (const file of eventFiles) {

		try {

			const filePath =
				path.join(eventsPath, file);

			delete require.cache[
				require.resolve(filePath)
			];

			const event =
				require(filePath);

			const eventName =
				event?.name;

			const execute =
				event?.execute ||
				event?.onStart;

			if (!eventName || !execute) {

				logger.warn(
					`Event load failed: ${file}`
				);

				continue;
			}

			if (event.once) {

				client.once(
					eventName,
					(...args) =>
					execute(...args, client)
				);

			} else {

				client.on(
					eventName,
					(...args) =>
					execute(...args, client)
				);
			}

			logger.info(
				`Loaded event: ${eventName}`
			);

		} catch (e) {

			logger.error(
				`Event Error (${file})`,
				e
			);
		}
	}

	logger.info(
		`${eventFiles.length}টি event load হয়েছে`
	);
};
