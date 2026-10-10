const { postClip } = require("../discord/clipsChannel");

function createClipWatcher({
	config,
	helix,
	getDiscordClient
}) {
	const seen = new Set();
	let primed = false;
	let timer = null;
	let posting = false;

	function remember(id) {
		if (!id) {
			return;
		}

		seen.add(String(id));

		if (seen.size > 400) {
			const extra = [...seen].slice(0, seen.size - 300);

			for (const old of extra) {
				seen.delete(old);
			}
		}
	}

	async function notifyCreated(clip) {
		if (!clip?.id) {
			return;
		}

		if (seen.has(String(clip.id))) {
			return;
		}

		remember(clip.id);

		const discord = typeof getDiscordClient === "function"
			? getDiscordClient()
			: null;

		if (!discord || !discord.isReady || !discord.isReady()) {
			seen.delete(String(clip.id));
			return;
		}

		try {
			const posted = await postClip(
				discord,
				{
					...clip,
					channel: config.channel,
					url: undefined
				},
				config.discordClipsChannelId
			);

			if (!posted) {
				seen.delete(String(clip.id));
			}
		} catch (error) {
			seen.delete(String(clip.id));
			console.warn(
				"[TWITCH] Envoi Discord clip impossible :",
				error.message || error
			);
		}
	}

	async function tick() {
		if (!helix.available || typeof helix.getClips !== "function") {
			return;
		}

		if (posting) {
			return;
		}

		posting = true;

		try {
			const startedAt = Date.now() - 2 * 60 * 60 * 1000;
			const clips = await helix.getClips({
				startedAt,
				first: 30
			});

			if (!Array.isArray(clips)) {
				return;
			}

			if (!primed) {
				for (const clip of clips) {
					remember(clip.id);
				}

				primed = true;
				return;
			}

			const fresh = clips
				.filter((clip) =>
					clip?.id &&
					clip.thumbnail_url &&
					!seen.has(String(clip.id))
				)
				.sort(
					(left, right) =>
						new Date(left.created_at || 0) - new Date(right.created_at || 0)
				);

			for (const clip of fresh) {
				await notifyCreated(clip);
			}
		} catch (error) {
			console.warn(
				"[TWITCH] Poll clips Helix :",
				error.message || error
			);
		} finally {
			posting = false;
		}
	}

	function start() {
		if (!helix.available) {
			return;
		}

		if (timer) {
			return;
		}

		tick();
		timer = setInterval(tick, config.clipsPollMs || 60000);

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

	return {
		start,
		stop,
		notifyCreated
	};
}

module.exports = {
	createClipWatcher
};
