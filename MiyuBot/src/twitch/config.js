function envFlag(name, fallback = false) {
	const raw = (process.env[name] || "").trim().toLowerCase();

	if (!raw) {
		return fallback;
	}

	return ["1", "true", "yes", "on"].includes(raw);
}

function envNumber(name, fallback) {
	const value = Number(process.env[name]);

	if (!Number.isFinite(value) || value < 0) {
		return fallback;
	}

	return value;
}

function envText(name, fallback = "") {
	const value = (process.env[name] || "").trim();
	return value || fallback;
}

function loadTwitchConfig() {
	const enabled = envFlag("TWITCH_ENABLED", false);

	const username = envText("TWITCH_USERNAME");
	const oauthRaw = envText("TWITCH_OAUTH_TOKEN").replace(/^["']+|["']+$/g, "");
	const channel = envText("TWITCH_CHANNEL").replace(/^#/, "").toLowerCase();

	const oauthToken = oauthRaw
		? (oauthRaw.toLowerCase().startsWith("oauth:") ? oauthRaw : `oauth:${oauthRaw}`)
		: "";

	return {
		enabled,
		username,
		oauthToken,
		channel,
		prefix: envText("TWITCH_PREFIX", "!"),
		clientId: envText("TWITCH_CLIENT_ID"),
		clientSecret: envText("TWITCH_CLIENT_SECRET"),
		discordLiveChannelId: envText("TWITCH_DISCORD_LIVE_CHANNEL_ID"),
		discordInvite: envText("TWITCH_DISCORD_INVITE"),
		twitter: envText("TWITCH_TWITTER"),
		youtube: envText("TWITCH_YOUTUBE"),
		socialsUrl: envText(
			"TWITCH_SOCIALS_URL",
			"https://sociallinks.edgeone.dev"
		),
		adsToken: envText("TWITCH_ADS_TOKEN").replace(/^oauth:/i, ""),
		adWarningSeconds: Math.max(5, envNumber("TWITCH_AD_WARNING_SECONDS", 30) || 30),
		adsPollMs: envNumber("TWITCH_ADS_POLL_MS", 8000),
		adWarningEnabled: envFlag("TWITCH_AD_WARNING", true),
		commandCooldownMs: envNumber("TWITCH_COMMAND_COOLDOWN_MS", 2500),
		userCooldownMs: envNumber("TWITCH_USER_COOLDOWN_MS", 4000),
		chatDelayMs: envNumber("TWITCH_CHAT_DELAY_MS", 1600),
		livePollMs: envNumber("TWITCH_LIVE_POLL_MS", 45000),
		automod: {
			enabled: envFlag("TWITCH_AUTOMOD", true),
			spamThreshold: envNumber("TWITCH_SPAM_THRESHOLD", 6),
			spamWindowMs: envNumber("TWITCH_SPAM_WINDOW_MS", 8000),
			repeatThreshold: envNumber("TWITCH_REPEAT_THRESHOLD", 3),
			capsMinLength: envNumber("TWITCH_CAPS_MIN_LENGTH", 12),
			capsRatio: Number(process.env.TWITCH_CAPS_RATIO || 0.8),
			linkTimeoutSeconds: envNumber("TWITCH_LINK_TIMEOUT", 1),
			spamTimeoutSeconds: envNumber("TWITCH_SPAM_TIMEOUT", 30),
			capsTimeoutSeconds: envNumber("TWITCH_CAPS_TIMEOUT", 5)
		}
	};
}

function missingRequired(config) {
	const missing = [];

	if (!config.username) {
		missing.push("TWITCH_USERNAME");
	}

	if (!config.oauthToken) {
		missing.push("TWITCH_OAUTH_TOKEN");
	}

	if (!config.channel) {
		missing.push("TWITCH_CHANNEL");
	}

	return missing;
}

module.exports = {
	loadTwitchConfig,
	missingRequired
};
