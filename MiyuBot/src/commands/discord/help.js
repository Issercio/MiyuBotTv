const {
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    name: "help",
    description: "Affiche la liste des commandes",

    execute(message) {
        const isAdmin =
            Boolean(message.member) &&
            message.member.permissions.has(
                PermissionFlagsBits.Administrator
            );

        const canMod =
            Boolean(message.member) &&
            (
                isAdmin ||
                message.member.permissions.has(PermissionFlagsBits.KickMembers) ||
                message.member.permissions.has(PermissionFlagsBits.BanMembers) ||
                message.member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
                message.member.permissions.has(PermissionFlagsBits.ManageMessages)
            );

        let text =
            "**Général**\n" +
            "`/ping` — Vérifie si MiyuBot répond\n" +
            "`/help` — Cette liste\n" +
            "`/userinfo` — Fiche membre";

        if (canMod) {
            text +=
                "\n\n**Modération**\n" +
                "`/ban` `/unban` `/kick` `/softban`\n" +
                "`/timeout` (`/mute`) `/untimeout` (`/unmute`)\n" +
                "`/warn` `/warnings` `/nick` `/purge` `/slowmode`";
        }

        if (isAdmin) {
            text +=
                "\n\n**Sécurité (admin)**\n" +
                "`/config` — Raid, nuke, spam, quarantaine, âge\n" +
                "`/securitylogs` — Salon de logs\n" +
                "`/lockdown` `/unlock`\n" +
                "`/antinuke` `/whitelist`\n" +
                "`/cases` `/setupcheck` `/syncmembers`";
        }

        return message.reply(text);
    }
};
