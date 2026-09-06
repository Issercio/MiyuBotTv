function parseAdTimestamp(value) {
	if (!value) {
		return 0;
	}

	if (typeof value === "number") {
		return value > 1e12 ? value : value * 1000;
	}

	const parsed = Date.parse(String(value));

	return Number.isFinite(parsed) ? parsed : 0;
}

function createAdsWatcher({
	config,
	helix,
	queue,
	isLive
}) {
	let timer = null;
	let broadcasterId = "";
	let warnedForAdAt = 0;
	let missingScopeLogged = false;
	let missingIdLogged = false;

	async function resolveBroadcasterId() {
		if (broadcasterId) {
			return broadcasterId;
		}

		const user = await helix.getUser(config.channel);

		if (!user?.id) {
			return "";
		}

		broadcasterId = user.id;
		return broadcasterId;
	}

	async function tick() {
		if (!config.adWarningEnabled || !helix.available) {
			return;
		}

		if (typeof isLive === "function" && !isLive()) {
			return;
		}

		try {
			const id = await resolveBroadcasterId();

			if (!id) {
				if (!missingIdLogged) {
					console.warn(
						"[TWITCH] Impossible de lire l'ID chaîne pour les pubs."
					);
					missingIdLogged = true;
				}

				return;
			}

			const result = await helix.getAdSchedule(id);

			if (!result?.ok) {
				if (!missingScopeLogged) {
					console.warn(
						"[TWITCH] Annonce pubs auto indisponible. " +
						"Ajoute TWITCH_ADS_TOKEN (token du streamer, scope channel:read:ads)."
					);
					missingScopeLogged = true;
				}

				return;
			}

			const nextAdAt = parseAdTimestamp(result.schedule?.next_ad_at);

			if (!nextAdAt) {
				return;
			}

			const remainingMs = nextAdAt - Date.now();
			const warningMs = config.adWarningSeconds * 1000;

			if (remainingMs > warningMs || remainingMs < 4000) {
				return;
			}

			if (warnedForAdAt === nextAdAt) {
				return;
			}

			warnedForAdAt = nextAdAt;

			const seconds = Math.max(
				1,
				Math.round(remainingMs / 1000)
			);

			await queue.say(
				`#${config.channel}`,
				`Votre attention : dans ${seconds}s une pub automatique va se lancer. Merci pour votre soutien !`
			);
		} catch (error) {
			console.warn(
				"[TWITCH] Poll pubs auto :",
				error.message || error
			);
		}
	}

	function start() {
		if (!config.adWarningEnabled) {
			return;
		}

		if (!helix.available) {
			console.log("[TWITCH] Helix inactif : alerte pubs auto désactivée");
			return;
		}

		tick();
		timer = setInterval(tick, config.adsPollMs);

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
		stop
	};
}

module.exports = {
	createAdsWatcher
};
