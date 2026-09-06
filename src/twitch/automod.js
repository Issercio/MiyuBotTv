const LINK_REGEX = /https?:\/\/|www\.|(?:^|\s)(?:discord\.gg|t\.co|bit\.ly)\/|\b[a-z0-9-]+\.(?:com|net|org|gg|tv|xyz|io)\b/i;
const ALLOWED_LINK_REGEX = /(?:clips\.twitch\.tv|twitch\.tv\/[a-z0-9_]+\/clip|youtu\.be|youtube\.com)/i;

function isPrivileged(tags, channelName) {
	const badges = tags.badges || {};
	const username = String(tags.username || "").toLowerCase();

	return Boolean(
		tags.mod ||
		badges.broadcaster ||
		badges.moderator ||
		username === String(channelName || "").toLowerCase()
	);
}

function createAutomod(config, client, queue) {
	const windows = new Map();
	const repeats = new Map();
	const permits = new Map();

	function permit(username, seconds = 60) {
		const key = String(username || "").toLowerCase().replace(/^@/, "");
		permits.set(key, Date.now() + seconds * 1000);
		return key;
	}

	function hasPermit(username) {
		const key = String(username || "").toLowerCase();
		const until = permits.get(key);

		if (!until) {
			return false;
		}

		if (Date.now() > until) {
			permits.delete(key);
			return false;
		}

		return true;
	}

	function countCapsRatio(text) {
		const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, "");

		if (!letters.length) {
			return 0;
		}

		const caps = letters.replace(/[^A-ZÀ-Ÿ]/g, "").length;
		return caps / letters.length;
	}

	async function punish(channel, tags, seconds, reason) {
		const username = tags.username;

		try {
			if (tags.id && typeof client.deletemessage === "function") {
				await client.deletemessage(channel, tags.id);
			}
		} catch (_error) {
			// Ignore delete failures and still timeout.
		}

		try {
			await client.timeout(channel, username, seconds, reason);
		} catch (error) {
			console.warn(
				"[TWITCH] Timeout automod impossible :",
				error.message || error
			);
		}

		await queue.say(
			channel,
			`@${tags["display-name"] || username} ${reason}`
		);
	}

	async function handle(channel, tags, message) {
		if (!config.automod.enabled) {
			return false;
		}

		if (tags["message-type"] === "action") {
			return false;
		}

		if (isPrivileged(tags, config.channel)) {
			return false;
		}

		const username = String(tags.username || "").toLowerCase();
		const now = Date.now();
		const text = String(message || "").trim();

		if (!text) {
			return false;
		}

		if (text.startsWith(config.prefix)) {
			return false;
		}

		const spamKey = username;
		const stamps = windows.get(spamKey) || [];
		const fresh = stamps.filter((stamp) => now - stamp < config.automod.spamWindowMs);
		fresh.push(now);
		windows.set(spamKey, fresh);

		if (fresh.length >= config.automod.spamThreshold) {
			windows.delete(spamKey);
			await punish(
				channel,
				tags,
				config.automod.spamTimeoutSeconds,
				"ralentis un peu, spam détecté."
			);
			return true;
		}

		const normalized = text.toLowerCase();
		const last = repeats.get(username);

		if (last && last.text === normalized && now - last.at < config.automod.spamWindowMs) {
			last.count += 1;
			last.at = now;
			repeats.set(username, last);

			if (last.count >= config.automod.repeatThreshold) {
				repeats.delete(username);
				await punish(
					channel,
					tags,
					config.automod.spamTimeoutSeconds,
					"évite de répéter le même message."
				);
				return true;
			}
		} else {
			repeats.set(username, {
				text: normalized,
				count: 1,
				at: now
			});
		}

		if (
			text.length >= config.automod.capsMinLength &&
			countCapsRatio(text) >= config.automod.capsRatio
		) {
			await punish(
				channel,
				tags,
				config.automod.capsTimeoutSeconds,
				"baisse les caps."
			);
			return true;
		}

		if (LINK_REGEX.test(text) && !ALLOWED_LINK_REGEX.test(text) && !hasPermit(username)) {
			await punish(
				channel,
				tags,
				config.automod.linkTimeoutSeconds,
				"les liens sont filtrés. Demande un permit à un modo."
			);
			return true;
		}

		return false;
	}

	return {
		handle,
		permit,
		isPrivileged
	};
}

module.exports = {
	createAutomod,
	isPrivileged
};
