const dns = require("dns");

if (typeof dns.setDefaultResultOrder === "function") {
	dns.setDefaultResultOrder("ipv4first");
}

console.log("🚀 Démarrage de MiyuBot...");

require("dotenv").config({
	override: process.env.NODE_ENV !== "production"
});

const {
	startHealthServer,
	setHealthStatusProvider
} = require("./health");

startHealthServer();

let discordClient = null;
let twitchRuntime = {
	enabled: false
};

try {
	discordClient = require("./discord");
} catch (error) {
	console.error("❌ Discord n'a pas démarré :", error);
}

try {
	twitchRuntime = require("./twitch");
} catch (error) {
	console.error("❌ Twitch n'a pas démarré :", error);
}

if (twitchRuntime && typeof twitchRuntime.setDiscordClient === "function") {
	twitchRuntime.setDiscordClient(discordClient);
}

setHealthStatusProvider(() => ({
	discord: Boolean(
		discordClient &&
		typeof discordClient.isReady === "function" &&
		discordClient.isReady()
	),
	twitch_enabled: Boolean(twitchRuntime && twitchRuntime.enabled),
	twitch_connected: Boolean(
		twitchRuntime &&
		typeof twitchRuntime.isConnected === "function" &&
		twitchRuntime.isConnected()
	),
	twitch_irc: twitchRuntime && typeof twitchRuntime.ircState === "function"
		? twitchRuntime.ircState()
		: "CLOSED",
	twitch_live: Boolean(
		twitchRuntime &&
		typeof twitchRuntime.isLive === "function" &&
		twitchRuntime.isLive()
	)
}));

let shutdownInProgress = false;

async function shutdownAll(signal) {
	if (shutdownInProgress) {
		return;
	}

	shutdownInProgress = true;

	console.log(`🛑 Arrêt demandé (${signal})...`);

	try {
		if (
			twitchRuntime &&
			twitchRuntime.enabled &&
			typeof twitchRuntime.shutdownTwitch === "function"
		) {
			await twitchRuntime.shutdownTwitch();
		}

		if (discordClient && typeof discordClient.destroy === "function") {
			discordClient.destroy();
			console.log("[DISCORD] Déconnexion propre effectuée");
		}
	} catch (error) {
		console.error("❌ Erreur pendant l'arrêt :", error);
	} finally {
		process.exit(0);
	}
}

process.on("SIGINT", () => shutdownAll("SIGINT"));
process.on("SIGTERM", () => shutdownAll("SIGTERM"));

process.on("unhandledRejection", (error) => {
	console.error("❌ Promesse non gérée :", error);
});

process.on("uncaughtException", (error) => {
	console.error("❌ Exception non gérée :", error);
});
