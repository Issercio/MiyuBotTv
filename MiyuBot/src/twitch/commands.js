const {
	run,
	get,
	all,
	claimCommand
} = require("../database/database");

const os = require("os");

const { isPrivileged } = require("./automod");

const BUILTIN_NAMES = new Set([
	"ping",
	"help",
	"uptime",
	"title",
	"game",
	"so",
	"shoutout",
	"socials",
	"discord",
	"cmd",
	"commands",
	"permit",
	"timeout",
	"ban",
	"unban",
	"slow",
	"slowoff",
	"followers",
	"followersoff",
	"emoteonly",
	"emoteonlyoff",
	"clear"
]);

function parseArgs(raw) {
	return String(raw || "").trim().split(/\s+/).filter(Boolean);
}

function createCommandRouter({
	config,
	client,
	queue,
	helix,
	automod
}) {
	const globalCooldown = new Map();
	const userCooldown = new Map();

	function onCooldown(commandName, username) {
		const now = Date.now();
		const lastGlobal = globalCooldown.get(commandName) || 0;
		const lastUser = userCooldown.get(`${username}:${commandName}`) || 0;

		if (now - lastGlobal < config.commandCooldownMs) {
			return true;
		}

		if (now - lastUser < config.userCooldownMs) {
			return true;
		}

		globalCooldown.set(commandName, now);
		userCooldown.set(`${username}:${commandName}`, now);
		return false;
	}

	async function reply(channel, tags, text) {
		const name = tags["display-name"] || tags.username;
		return queue.say(channel, `@${name} ${text}`);
	}

	async function handleCustom(channel, tags, name) {
		const row = await get(
			`
			SELECT name, response, cooldown_seconds, mod_only
			FROM twitch_custom_commands
			WHERE name = ?
			`,
			[name]
		);

		if (!row) {
			return false;
		}

		if (row.mod_only && !isPrivileged(tags, config.channel)) {
			return true;
		}

		const cooldownMs = Math.max(1000, Number(row.cooldown_seconds || 5) * 1000);
		const key = `custom:${row.name}`;
		const now = Date.now();

		if (now - (globalCooldown.get(key) || 0) < cooldownMs) {
			return true;
		}

		globalCooldown.set(key, now);

		await queue.say(channel, row.response);
		return true;
	}

	async function handleBuiltin(channel, tags, commandName, args) {
		const privileged = isPrivileged(tags, config.channel);

		if (commandName === "ping") {
			const instance = process.env.FLY_MACHINE_ID
				? `fly/${process.env.FLY_REGION || "?"}/${String(process.env.FLY_MACHINE_ID).slice(0, 8)}`
				: `local/${os.hostname()}`;

			await reply(
				channel,
				tags,
				`Pong. MiyuBot Twitch est en ligne. [${instance}]`
			);
			return;
		}

		if (commandName === "help" || commandName === "commands") {
			await reply(
				channel,
				tags,
				"Commandes : !ping !uptime !title !game !socials !discord !so. Modos : !permit !timeout !ban !clear !slow !cmd"
			);
			return;
		}

		if (commandName === "socials") {
			const parts = [];

			if (config.discordInvite) {
				parts.push(`Discord ${config.discordInvite}`);
			}

			if (config.twitter) {
				parts.push(`X ${config.twitter}`);
			}

			if (config.youtube) {
				parts.push(`YouTube ${config.youtube}`);
			}

			if (config.tiktok) {
				parts.push(`TikTok ${config.tiktok}`);
			}

			await reply(
				channel,
				tags,
				parts.length ? parts.join(" | ") : "Aucun réseau configuré."
			);
			return;
		}

		if (commandName === "discord") {
			const invite =
				config.discordInvite ||
				"https://discord.gg/7KyxTPEwXv";

			await queue.say(
				channel,
				"Rejoins le sanctuaire de Kitsunara sur Discord ! " +
				"Papotages, créations, chill et bonne humeur t’attendent " +
				`sous les cerisiers 🌸🎐 → ${invite}`
			);
			return;
		}

		if (commandName === "uptime" || commandName === "title" || commandName === "game") {
			if (!helix.available) {
				await reply(
					channel,
					tags,
					"Helix non configuré (TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET)."
				);
				return;
			}

			const stream = await helix.getStream(config.channel);

			if (!stream) {
				await reply(channel, tags, "Hors live pour le moment.");
				return;
			}

			if (commandName === "uptime") {
				await reply(
					channel,
					tags,
					`En live depuis ${helix.formatUptime(stream.started_at)}.`
				);
				return;
			}

			if (commandName === "title") {
				await reply(channel, tags, stream.title || "Titre indisponible.");
				return;
			}

			await reply(channel, tags, stream.game_name || "Jeu inconnu.");
			return;
		}

		if (commandName === "so" || commandName === "shoutout") {
			if (!privileged) {
				return;
			}

			const target = String(args[0] || "").replace(/^@/, "").toLowerCase();

			if (!target) {
				await reply(channel, tags, "Usage : !so pseudo");
				return;
			}

			const url = `https://twitch.tv/${target}`;
			let displayName = target;
			let gameName = "un jeu inconnu";

			if (helix.available) {
				const user = await helix.getUser(target);

				if (user) {
					displayName = user.display_name || target;
					const stream = await helix.getStream(target);
					const channelInfo = await helix.getChannel(user.id);
					gameName =
						stream?.game_name ||
						channelInfo?.game_name ||
						gameName;
				}
			}

			await queue.say(
				channel,
				`Traversez les sentiers lumineux de ${url} ` +
				`pour découvrir ${displayName} ` +
				`qui a joué pour la dernière fois à ${gameName} !`
			);
			return;
		}

		if (!privileged) {
			return;
		}

		if (commandName === "permit") {
			const target = String(args[0] || "").replace(/^@/, "");
			const seconds = Math.min(300, Math.max(15, Number(args[1]) || 60));

			if (!target) {
				await reply(channel, tags, "Usage : !permit pseudo [secondes]");
				return;
			}

			const name = automod.permit(target, seconds);
			await queue.say(
				channel,
				`@${name} tu peux poster un lien pendant ${seconds}s.`
			);
			return;
		}

		if (commandName === "timeout") {
			const target = String(args[0] || "").replace(/^@/, "");
			const seconds = Math.min(1209600, Math.max(1, Number(args[1]) || 60));
			const reason = args.slice(2).join(" ") || "modération";

			if (!target) {
				await reply(channel, tags, "Usage : !timeout pseudo [secondes] [raison]");
				return;
			}

			await client.timeout(channel, target, seconds, reason);
			await queue.say(channel, `${target} timeout ${seconds}s (${reason}).`);
			return;
		}

		if (commandName === "ban") {
			const target = String(args[0] || "").replace(/^@/, "");
			const reason = args.slice(1).join(" ") || "modération";

			if (!target) {
				await reply(channel, tags, "Usage : !ban pseudo [raison]");
				return;
			}

			await client.ban(channel, target, reason);
			await queue.say(channel, `${target} banni (${reason}).`);
			return;
		}

		if (commandName === "unban") {
			const target = String(args[0] || "").replace(/^@/, "");

			if (!target) {
				await reply(channel, tags, "Usage : !unban pseudo");
				return;
			}

			await client.unban(channel, target);
			await queue.say(channel, `${target} débanni.`);
			return;
		}

		if (commandName === "slow") {
			const seconds = Math.min(120, Math.max(3, Number(args[0]) || 5));
			await client.slow(channel, seconds);
			await queue.say(channel, `Slow mode ${seconds}s.`);
			return;
		}

		if (commandName === "slowoff") {
			await client.slowoff(channel);
			await queue.say(channel, "Slow mode off.");
			return;
		}

		if (commandName === "followers") {
			const minutes = Math.min(10080, Math.max(0, Number(args[0]) || 0));
			await client.followersonly(channel, minutes);
			await queue.say(channel, `Followers-only ${minutes}m.`);
			return;
		}

		if (commandName === "followersoff") {
			await client.followersonlyoff(channel);
			await queue.say(channel, "Followers-only off.");
			return;
		}

		if (commandName === "emoteonly") {
			await client.emoteonly(channel);
			await queue.say(channel, "Emote-only on.");
			return;
		}

		if (commandName === "emoteonlyoff") {
			await client.emoteonlyoff(channel);
			await queue.say(channel, "Emote-only off.");
			return;
		}

		if (commandName === "clear") {
			await client.clear(channel);
			return;
		}

		if (commandName === "cmd") {
			const action = String(args[0] || "").toLowerCase();
			const name = String(args[1] || "").toLowerCase().replace(/^!/, "");

			if (action === "list") {
				const rows = await all(
					`
					SELECT name
					FROM twitch_custom_commands
					ORDER BY name ASC
					`
				);

				const names = rows.map((row) => `!${row.name}`).join(" ");
				await reply(
					channel,
					tags,
					names ? `Customs : ${names}` : "Aucune commande custom."
				);
				return;
			}

			if (action === "remove" || action === "del") {
				if (!name) {
					await reply(channel, tags, "Usage : !cmd remove nom");
					return;
				}

				await run(
					`
					DELETE FROM twitch_custom_commands
					WHERE name = ?
					`,
					[name]
				);

				await reply(channel, tags, `Commande !${name} supprimée.`);
				return;
			}

			if (action === "add") {
				const response = args.slice(2).join(" ").trim();

				if (!name || !response) {
					await reply(channel, tags, "Usage : !cmd add nom réponse");
					return;
				}

				if (BUILTIN_NAMES.has(name)) {
					await reply(channel, tags, "Ce nom est réservé.");
					return;
				}

				const now = Date.now();

				await run(
					`
					INSERT INTO twitch_custom_commands (
						name,
						response,
						cooldown_seconds,
						mod_only,
						created_at,
						updated_at
					)
					VALUES (?, ?, 5, 0, ?, ?)
					ON CONFLICT(name) DO UPDATE SET
						response = excluded.response,
						updated_at = excluded.updated_at
					`,
					[name, response, now, now]
				);

				await reply(channel, tags, `Commande !${name} enregistrée.`);
				return;
			}

			await reply(channel, tags, "Usage : !cmd add|remove|list");
		}
	}

	async function handleMessage(channel, tags, message, self) {
		if (self) {
			return;
		}

		const text = String(message || "").trim();

		if (!text.startsWith(config.prefix)) {
			return;
		}

		const withoutPrefix = text.slice(config.prefix.length).trim();
		const [rawName, ...rest] = parseArgs(withoutPrefix);
		const commandName = String(rawName || "").toLowerCase();

		if (!commandName) {
			return;
		}

		const twitchMessageId = tags.id
			? `twitch:${tags.id}`
			: `twitch:${channel}:${tags.username}:${commandName}:${text}`;

		const claimed = await claimCommand(twitchMessageId);

		if (!claimed) {
			return;
		}

		const username = String(tags.username || "").toLowerCase();

		if (BUILTIN_NAMES.has(commandName)) {
			if (onCooldown(commandName, username) && !isPrivileged(tags, config.channel)) {
				return;
			}

			await handleBuiltin(channel, tags, commandName, rest);
			return;
		}

		await handleCustom(channel, tags, commandName);
	}

	return {
		handleMessage
	};
}

module.exports = {
	createCommandRouter
};
