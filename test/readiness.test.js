const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = path.join(root, "src");

function read(rel) {
    return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("batterie Discord", () => {
    const commandDir = path.join(src, "commands", "discord");
    const commandFiles = fs
        .readdirSync(commandDir)
        .filter((file) => file.endsWith(".js"));
    const definitions = read("src/discord/slashDefinitions.js");
    const discord = read("src/discord.js");
    const logger = read("src/security/securityLogger.js");

    test("toutes les commandes du dossier ont un module slash", () => {
        for (const file of commandFiles) {
            const name = file.replace(/\.js$/, "");
            assert.match(
                definitions,
                new RegExp(`\\b${name}:`),
                `slash manquant : ${name}`
            );
        }
    });

    test("handler slash + enregistrement par serveur", () => {
        assert.match(discord, /interactionCreate/);
        assert.match(discord, /registerGuildSlashCommands/);
        assert.match(discord, /guildCreate/);
        assert.match(discord, /clientReady/);
        assert.match(discord, /GatewayIntentBits\.GuildVoiceStates/);
        assert.match(discord, /GatewayIntentBits\.GuildMembers/);
        assert.match(discord, /GatewayIntentBits\.MessageContent/);
    });

    test("logs vocaux join / move / leave / modo", () => {
        assert.match(discord, /hydrateVoiceChannelTracker/);
        assert.match(discord, /logVoiceChannelChange/);
        assert.match(discord, /Vocal — join/);
        assert.match(discord, /Vocal — leave/);
        assert.match(discord, /Vocal — move/);
        assert.match(discord, /Vocal — déconnecté/);
        assert.match(discord, /AuditLogEvent\.MemberMove/);
        assert.match(discord, /AuditLogEvent\.MemberDisconnect/);
    });

    test("salon de logs retrouvé après wipe SQLite", () => {
        assert.match(logger, /miyubot\[-_\]\?logs/i);
        assert.match(logger, /persistLogChannel/);
        assert.match(logger, /findMiyuLogChannel/);
    });

    test("copie Fly Discord alignée", () => {
        const nested = read("MiyuBot/src/discord.js");
        assert.match(nested, /hydrateVoiceChannelTracker/);
        assert.match(nested, /registerGuildSlashCommands/);
    });
});

describe("batterie Twitch", () => {
    const commands = read("src/twitch/commands.js");
    const ads = read("src/twitch/adsWatcher.js");
    const helix = read("src/twitch/helix.js");
    const twitch = read("src/twitch.js");

    test("commandes publiques et modos présentes", () => {
        for (const name of [
            "ping", "help", "uptime", "title", "game", "so",
            "discord", "socials", "permit", "timeout", "ban", "cmd"
        ]) {
            assert.match(commands, new RegExp(`"${name}"`), name);
        }
    });

    test("textes Kitsunara so et discord", () => {
        assert.match(commands, /sentiers lumineux/);
        assert.match(commands, /sanctuaire de Kitsunara/);
        assert.match(commands, /sociallinks\.edgeone\.dev/);
        assert.match(commands, /discord\.com\/invite/);
        assert.match(read("src/twitch/chatQueue.js"), /chat say timeout/);
    });

    test("alerte pubs auto 30s", () => {
        assert.match(helix, /getAdSchedule/);
        assert.match(helix, /channels\/ads/);
        assert.match(ads, /pub automatique va se lancer/);
        assert.match(ads, /adWarningSeconds/);
        assert.match(twitch, /createAdsWatcher/);
        assert.match(twitch, /adsWatcher\.start/);
    });

    test("copie Fly Twitch alignée", () => {
        const nestedAds = read("MiyuBot/src/twitch/adsWatcher.js");
        const nestedCmd = read("MiyuBot/src/twitch/commands.js");
        const nestedTwitch = read("MiyuBot/src/twitch.js");
        assert.match(nestedAds, /pub automatique va se lancer/);
        assert.match(nestedCmd, /sentiers lumineux/);
        assert.match(nestedCmd, /discord\.com\/invite/);
        assert.match(read("MiyuBot/src/twitch/chatQueue.js"), /chat say timeout/);
        assert.match(nestedTwitch, /ipv4first/);
        assert.match(nestedTwitch, /connectTwitch/);
        assert.match(read("src/twitch.js"), /ipv4first/);
        assert.match(read("src/index.js"), /ipv4first/);
    });
});
