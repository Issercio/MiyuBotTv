const dns = require("dns");
const https = require("https");
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
const { createDonateWatcher } = require("./twitch/donateWatcher");
const { isForeignSharedChat } = require("./twitch/sharedChat");

const config = loadTwitchConfig();

if (!config.enabled) {
	console.log("[TWITCH] Module désactivé (TWITCH_ENABLED=false)");

	module.exports = {
		enabled: false,
		client: null,
		isConnected: () => false,
		ircState: () => "CLOSED",
		lastError: () => "",
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
		lastError: () => "",
		isLive: () => false,
		setDiscordClient: () => {},
		shutdownTwitch: async () => {}
	};

	return;
}

let connected = false;
let shuttingDown = false;
let connectAttempt = 0;
let reconnectTimer = null;
let connectingSince = 0;
let lastIrcError = "";
let useIpv4Agent = true;

const ipv4Agent = new https.Agent({
	family: 4,
	keepAlive: false
});

const client = new tmi.Client({
	options: {
		debug: false
	},
	logger: {
		info: () => {},
		warn: (message) => {
			console.warn("[TWITCH]", message);
		},
		error: (message) => {
			const text = String(message || "erreur irc");

			if (text.includes("Cannot disconnect")) {
				return;
			}

			lastIrcError = text.slice(0, 180);
			console.error("[TWITCH]", lastIrcError);
		}
	},
	identity: {
		username: String(config.username || "").toLowerCase(),
		password: config.oauthToken
	},
	channels: [config.channel],
	connection: {
		server: "irc-ws.chat.twitch.tv",
		port: 443,
		reconnect: false,
		secure: true,
		timeout: 10000
	}
});

const helix = createHelix(config);
const queue = createChatQueue(
	client,
	config.chatDelayMs,
	(text) => helix.sendChatMessage(text, { sourceOnly: true }),
	(text) => helix.sendChatAnnouncement(text, { sourceOnly: true })
);
const automod = createAutomod(config, client, queue);
const commands = createCommandRouter({
	config,
	client,
	queue,
	helix,
	automod
});

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
const donateWatcher = createDonateWatcher({
	config,
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

function rememberError(error) {
	lastIrcError = getErrorText(error).slice(0, 180);
}

function applyDnsFamily() {
	if (typeof dns.setDefaultResultOrder !== "function") {
		return;
	}

	dns.setDefaultResultOrder(useIpv4Agent ? "ipv4first" : "verbatim");
}

function applyConnectionAgent() {
	if (useIpv4Agent) {
		client.opts.connection.agent = ipv4Agent;
		return "IPv4";
	}

	delete client.opts.connection.agent;
	return "auto";
}

function killSocket() {
	const socket = client.ws;

	if (!socket) {
		return;
	}

	client.wasCloseCalled = true;

	try {
		if (typeof socket.terminate === "function") {
			socket.terminate();
		} else if (typeof socket.close === "function") {
			socket.close();
		}
	} catch (error) {
		rememberError(error);
	}
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
	const hungConnecting =
		state === "CONNECTING" &&
		connectingSince > 0 &&
		Date.now() - connectingSince > 12000;

	if (state === "OPEN") {
		connected = true;
		connectingSince = 0;
		return;
	}

	if (state === "CONNECTING" && !hungConnecting) {
		scheduleReconnect(2000);
		return;
	}

	if (hungConnecting || state === "CLOSING") {
		const authFail = /login authentication failed/i.test(lastIrcError);

		if (!authFail) {
			lastIrcError = "handshake IRC bloqué, reset du socket";
			console.warn("[TWITCH]", lastIrcError);
			useIpv4Agent = !useIpv4Agent;
		}

		connectingSince = 0;
		killSocket();
		scheduleReconnect(authFail ? 60000 : 1500);
		return;
	}

	connectAttempt += 1;
	connectingSince = Date.now();
	applyDnsFamily();
	const via = applyConnectionAgent();
	console.log(`[TWITCH] Connexion IRC essai ${connectAttempt} (${via})`);

	const killTimer = setTimeout(() => {
		if (ircState() !== "OPEN") {
			lastIrcError = `timeout handshake IRC 12s (${via})`;
			console.warn("[TWITCH]", lastIrcError);
			killSocket();
		}
	}, 12000);

	if (typeof killTimer.unref === "function") {
		killTimer.unref();
	}

	try {
		await client.connect();
		clearTimeout(killTimer);
	} catch (error) {
		clearTimeout(killTimer);
		connected = false;
		rememberError(error);
		console.error(
			`[TWITCH] Échec de connexion (essai ${connectAttempt}) :`,
			lastIrcError
		);
		const authFail = /login authentication failed/i.test(lastIrcError);

		if (!authFail) {
			useIpv4Agent = !useIpv4Agent;
		}

		killSocket();
		scheduleReconnect(
			authFail ? 60000 : Math.min(20000, 2000 * connectAttempt)
		);
	}
}

client.on("connected", (address, port) => {
	connected = true;
	connectAttempt = 0;
	connectingSince = 0;
	lastIrcError = "";
	console.log(
		`[TWITCH] Connecté ${address}:${port} — #${config.channel}`
	);
	liveWatcher.start();
	adsWatcher.start();
	donateWatcher.start();
});

client.on("disconnected", (reason) => {
	connected = false;
	console.warn(`[TWITCH] Déconnecté : ${reason}`);
	rememberError(reason);

	if (!shuttingDown) {
		const authFail = /login authentication failed/i.test(String(reason || ""));
		scheduleReconnect(authFail ? 60000 : 3000);
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
		if (self) {
			return;
		}

		if (isForeignSharedChat(tags)) {
			return;
		}

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
	donateWatcher.stop();

	if (ircState() !== "OPEN") {
		killSocket();
		return;
	}

	try {
		await client.disconnect();
		console.log("[TWITCH] Déconnexion propre effectuée");
	} catch (error) {
		killSocket();
		console.error("[TWITCH] Erreur pendant la déconnexion :", getErrorText(error));
	}
}

module.exports = {
	enabled: true,
	client,
	isConnected: () => ircState() === "OPEN",
	ircState,
	lastError: () => lastIrcError,
	botLogin: () => String(config.username || "").toLowerCase(),
	isLive: () => liveWatcher.isLive(),
	setDiscordClient,
	shutdownTwitch
};
