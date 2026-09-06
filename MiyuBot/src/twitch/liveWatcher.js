function createLiveWatcher({
	config,
	helix,
	queue,
	getDiscordClient
}) {
	let wasLive = false;
	let primed = false;
	let timer = null;

	async function notifyDiscord(stream) {
		const channelId = config.discordLiveChannelId;

		if (!channelId) {
			return;
		}

		const discord = typeof getDiscordClient === "function"
			? getDiscordClient()
			: null;

		if (!discord || !discord.isReady || !discord.isReady()) {
			return;
		}

		try {
			const channel = await discord.channels.fetch(channelId);

			if (!channel || typeof channel.send !== "function") {
				return;
			}

			await channel.send(
				`🔴 **${config.channel} est en live**\n` +
				`${stream.title || "Live"}\n` +
				`${stream.game_name ? `Jeu : ${stream.game_name}\n` : ""}` +
				`https://twitch.tv/${config.channel}`
			);
		} catch (error) {
			console.warn(
				"[TWITCH] Annonce Discord live impossible :",
				error.message || error
			);
		}
	}

	async function tick() {
		if (!helix.available) {
			return;
		}

		try {
			const stream = await helix.getStream(config.channel);
			const live = Boolean(stream);

			if (!primed) {
				wasLive = live;
				primed = true;
				return;
			}

			if (live && !wasLive) {
				console.log(`[TWITCH] Passage en live : ${stream.title}`);

				await queue.say(
					`#${config.channel}`,
					`Live ON. ${stream.title || ""}`.trim()
				);

				await notifyDiscord(stream);
			}

			if (!live && wasLive) {
				console.log("[TWITCH] Live terminé");
			}

			wasLive = live;
		} catch (error) {
			console.warn(
				"[TWITCH] Poll live Helix :",
				error.message || error
			);
		}
	}

	function start() {
		if (!helix.available) {
			console.log(
				"[TWITCH] Helix inactif : !uptime / live Discord indisponibles"
			);
			return;
		}

		tick();
		timer = setInterval(tick, config.livePollMs);

		if (typeof timer.unref === "function") {
			timer.unref();
		}
	}

	function stop() {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	}

	function isLive() {
		return wasLive;
	}

	return {
		start,
		stop,
		isLive
	};
}

module.exports = {
	createLiveWatcher
};
