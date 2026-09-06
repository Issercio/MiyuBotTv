const tmi = require("tmi.js");

const { loadTwitchConfig, missingRequired } = require("./twitch/config");
const { createHelix } = require("./twitch/helix");
const { createChatQueue } = require("./twitch/chatQueue");
const { createAutomod } = require("./twitch/automod");
const { createCommandRouter } = require("./twitch/commands");
const { createLiveWatcher } = require("./twitch/liveWatcher");
const { createAdsWatcher } = require("./twitch/adsWatcher");

const config = loadTwitchConfig();

if (!config.enabled) {
	console.log("[TWITCH] Module désactivé (TWITCH_ENABLED=false)");

	module.exports = {
		enabled: false,
		client: null,
		isConnected: () => false,
		isLive: () => false,
		setDiscordClient: () => {},
		shutdownTwitch: async () => {}
	};

	return;
}

const missing = missingRequired(config);

if (missing.length > 0) {
	console.warn(
		"[TWITCH] Module désactivé. Variables manquantes :",
		missing.join(", ")
	);

	module.exports = {
		enabled: false,
		client: null,
		isConnected: () => false,
		isLive: () => false,
		setDiscordClient: () => {},
		shutdownTwitch: async () => {}
	};

	return;
}

const client = new tmi.Client({
	options: {
		debug: false
	},
	identity: {
		username: config.username,
		password: config.oauthToken
	},
	channels: [config.channel],
	connection: {
		reconnect: true,
		secure: true,
		timeout: 20000,
		reconnectInterval: 2000,
		maxReconnectInterval: 30000,
		maxReconnectAttempts: Infinity
	}
});

const queue = createChatQueue(client, config.chatDelayMs);
const helix = createHelix(config);
const automod = createAutomod(config, client, queue);
const commands = createCommandRouter({
	config,
	client,
	queue,
	helix,
	automod
});

let connected = false;

let discordClientRef = null;

function setDiscordClient(client) {
	discordClientRef = client;
}

function getDiscordClient() {
	return discordClientRef;
}

const liveWatcher = createLiveWatcher({
	config,
	helix,
	queue,
	getDiscordClient
});

const adsWatcher = createAdsWatcher({
	config,
	helix,
	queue,
	isLive: () => liveWatcher.isLive()
});

function getErrorText(error) {
	if (!error) {
		return "erreur inconnue";
	}

	if (typeof error === "string") {
		return error;
	}

	return error.message || JSON.stringify(error);
}

client.on("connected", (address, port) => {
	connected = true;
	console.log(
		`[TWITCH] Connecté ${address}:${port} — #${config.channel}`
	);
	liveWatcher.start();
	adsWatcher.start();
});

client.on("disconnected", (reason) => {
	connected = false;
	console.warn(`[TWITCH] Déconnecté : ${reason}`);
});

client.on("reconnect", () => {
	console.log("[TWITCH] Reconnexion IRC...");
});

client.on("notice", (channel, msgid, message) => {
	if (!msgid) {
		return;
	}

	if (
		msgid.includes("auth") ||
		msgid.includes("login") ||
		msgid === "msg_banned" ||
		msgid === "msg_channel_suspended"
	) {
		console.error(`[TWITCH] Notice ${msgid} : ${message}`);
	}
});

client.on("message", async (channel, tags, message, self) => {
	try {
		const blocked = await automod.handle(channel, tags, message);

		if (blocked) {
			return;
		}

		await commands.handleMessage(channel, tags, message, self);
	} catch (error) {
		console.error("[TWITCH] Erreur message :", getErrorText(error));
	}
});

client.connect().catch((error) => {
	console.error("[TWITCH] Échec de connexion :", getErrorText(error));
});

async function shutdownTwitch() {
	liveWatcher.stop();
	adsWatcher.stop();

	if (!connected) {
		return;
	}

	try {
		await client.disconnect();
		console.log("[TWITCH] Déconnexion propre effectuée");
	} catch (error) {
		console.error("[TWITCH] Erreur pendant la déconnexion :", getErrorText(error));
	}
}

module.exports = {
	enabled: true,
	client,
	isConnected: () => connected,
	isLive: () => liveWatcher.isLive(),
	setDiscordClient,
	shutdownTwitch
};
