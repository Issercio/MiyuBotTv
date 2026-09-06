const dns = require("dns");
const tmi = require("tmi.js");

if (typeof dns.setDefaultResultOrder === "function") {
	dns.setDefaultResultOrder("ipv4first");
}

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
		ircState: () => "CLOSED",
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
		ircState: () => "CLOSED",
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
		server: "irc-ws.chat.twitch.tv",
		port: 443,
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
let shuttingDown = false;
let connectAttempt = 0;
let reconnectTimer = null;

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

function ircState() {
	if (typeof client.readyState === "function") {
		return client.readyState();
	}

	return connected ? "OPEN" : "CLOSED";
}

function scheduleReconnect(delayMs) {
	if (shuttingDown || reconnectTimer) {
		return;
	}

	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connectTwitch();
	}, delayMs);

	if (typeof reconnectTimer.unref === "function") {
		reconnectTimer.unref();
	}
}

async function connectTwitch() {
	if (shuttingDown) {
		return;
	}

	const state = ircState();

	if (state === "OPEN") {
		connected = true;
		return;
	}

	if (state === "CONNECTING") {
		scheduleReconnect(5000);
		return;
	}

	connectAttempt += 1;

	try {
		await client.connect();
	} catch (error) {
		connected = false;
		console.error(
			`[TWITCH] Échec de connexion (essai ${connectAttempt}) :`,
			getErrorText(error)
		);
		scheduleReconnect(Math.min(30000, 2000 * connectAttempt));
	}
}

client.on("connected", (address, port) => {
	connected = true;
	connectAttempt = 0;
	console.log(
		`[TWITCH] Connecté ${address}:${port} — #${config.channel}`
	);
	liveWatcher.start();
	adsWatcher.start();
});

client.on("disconnected", (reason) => {
	connected = false;
	console.warn(`[TWITCH] Déconnecté : ${reason}`);

	if (!shuttingDown) {
		scheduleReconnect(3000);
	}
});

client.on("reconnect", () => {
	console.log("[TWITCH] Reconnexion IRC...");
});

client.on("join", (channel, username, self) => {
	if (self) {
		console.log(`[TWITCH] JOIN ${channel} en tant que ${username}`);
	}
});

client.on("notice", (channel, msgid, message) => {
	if (!msgid) {
		return;
	}

	console.warn(`[TWITCH] Notice ${msgid} : ${message}`);
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

connectTwitch();

async function shutdownTwitch() {
	shuttingDown = true;

	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	liveWatcher.stop();
	adsWatcher.stop();

	if (ircState() === "CLOSED") {
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
	isConnected: () => ircState() === "OPEN",
	ircState,
	isLive: () => liveWatcher.isLive(),
	setDiscordClient,
	shutdownTwitch
};
