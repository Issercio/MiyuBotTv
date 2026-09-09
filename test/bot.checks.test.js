const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const USER_ID_REGEX = /^(?:<@!?(\d{17,22})>|(\d{17,22}))$/;

function parseUserId(input) {
    if (!input) return null;
    const match = String(input).trim().match(USER_ID_REGEX);
    return match ? (match[1] || match[2]) : null;
}

function parseDurationMs(input) {
    if (!input) return 10 * 60 * 1000;
    const match = String(input).trim().toLowerCase().match(/^(\d+)\s*(s|sec|secs|m|min|h|d|j)?$/);
    if (!match) return null;
    const amount = Number(match[1]);
    const unit = match[2] || "m";
    const multipliers = {
        s: 1000, sec: 1000, secs: 1000,
        m: 60 * 1000, min: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        j: 24 * 60 * 60 * 1000
    };
    return amount * (multipliers[unit] || multipliers.m);
}

describe("ids et durées", () => {
    test("parseUserId", () => {
        assert.equal(parseUserId("<@123456789012345678>"), "123456789012345678");
        assert.equal(parseUserId("123456789012345678"), "123456789012345678");
        assert.equal(parseUserId("abc"), null);
    });

    test("parseDurationMs", () => {
        assert.equal(parseDurationMs("10s"), 10000);
        assert.equal(parseDurationMs("10m"), 600000);
        assert.equal(parseDurationMs("1h"), 3600000);
        assert.equal(parseDurationMs("nope"), null);
    });
});

describe("modules commandes Discord", () => {
    const dir = path.join(__dirname, "..", "src", "commands", "discord");
    const files = fs.readdirSync(dir).filter((file) => file.endsWith(".js"));

    test("chaque fichier commande a un name et un execute", () => {
        for (const file of files) {
            const text = fs.readFileSync(path.join(dir, file), "utf8");
            assert.match(text, /name:\s*["'][a-z]+["']/, file);
            assert.match(text, /execute\s*\(/, file);
        }
        assert.ok(files.length >= 20);
    });
});

describe("slash definitions", () => {
    const text = fs.readFileSync(
        path.join(__dirname, "..", "src", "discord", "slashDefinitions.js"),
        "utf8"
    );

    test("les commandes principales sont définies", () => {
        for (const name of [
            "ping", "help", "ban", "kick", "timeout", "mute",
            "warn", "purge", "securitylogs", "config", "lockdown"
        ]) {
            assert.match(text, new RegExp(`\\b${name}:`), name);
        }
    });
});

describe("preset sécurité", () => {
    const text = fs.readFileSync(
        path.join(__dirname, "..", "src", "security", "starterPreset.js"),
        "utf8"
    );

    test("kick auto 30 jours et anti-raid", () => {
        assert.match(text, /min_account_age_days:\s*30/);
        assert.match(text, /anti_raid_enabled:\s*1/);
        assert.match(text, /anti_nuke_enabled:\s*1/);
    });
});

describe("README slash", () => {
    const text = fs.readFileSync(
        path.join(__dirname, "..", "README.md"),
        "utf8"
    );

    test("documente les commandes slash Discord", () => {
        assert.match(text, /\/ping/);
        assert.match(text, /\/securitylogs/);
        assert.match(text, /slash/i);
    });

    test("indique où récupérer les tokens sans URL d'app perso", () => {
        assert.match(text, /discord\.com\/developers\/applications/);
        assert.match(text, /dev\.twitch\.tv\/console\/apps/);
        assert.match(text, /twitchtokengenerator\.com/);
        assert.match(text, /id\.twitch\.tv\/oauth2\/authorize/);
        assert.doesNotMatch(text, /miyubottv\.fly\.dev/);
        assert.doesNotMatch(text, /discord\.gg\/[A-Za-z0-9]/);
        assert.match(text, /!donate/);
        assert.match(text, /!clip/);
        assert.match(text, /!lurk/);
        assert.match(text, /!cmd add/);
    });
});

describe("handler slash", () => {
    const text = fs.readFileSync(
        path.join(__dirname, "..", "src", "discord.js"),
        "utf8"
    );

    test("enregistre et exécute les interactions", () => {
        assert.match(text, /interactionCreate/);
        assert.match(text, /registerGuildSlashCommands/);
        assert.match(text, /isChatInputCommand/);
        assert.match(text, /commandes \*\*slash\*\*/);
    });
});

describe("tchat partagé Twitch", () => {
    const { isForeignSharedChat, isSharedChatStreamer } = require("../src/twitch/sharedChat");

    test("ignore les messages venant d'une autre chaîne", () => {
        assert.equal(
            isForeignSharedChat({ "room-id": "1", "source-room-id": "2" }),
            true
        );
        assert.equal(
            isForeignSharedChat({ "room-id": "1", "source-room-id": "1" }),
            false
        );
        assert.equal(isForeignSharedChat({ "room-id": "1" }), false);
    });

    test("reconnaît un streameur du tchat partagé", () => {
        assert.equal(
            isSharedChatStreamer({ "source-badges": "broadcaster/1,subscriber/0" }),
            true
        );
        assert.equal(isSharedChatStreamer({ badges: { moderator: "1" } }), false);
        assert.equal(isSharedChatStreamer({ badges: { broadcaster: "1" } }), true);
    });
});
