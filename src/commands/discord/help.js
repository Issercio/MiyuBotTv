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
                message.member.permissions.has(
                    PermissionFlagsBits.KickMembers
                ) ||
                message.member.permissions.has(
                    PermissionFlagsBits.BanMembers
                ) ||
                message.member.permissions.has(
                    PermissionFlagsBits.ModerateMembers
                ) ||
                message.member.permissions.has(
                    PermissionFlagsBits.ManageMessages
                )
            );

        const publicCommands =
            "**Général**\n" +
            "`!ping` — Vérifie si MiyuBot répond\n" +
            "`!help` — Cette liste\n" +
            "`!userinfo [@membre]` — Fiche membre";

        let text = publicCommands;

        if (canMod) {
            text +=
                "\n\n**Modération**\n" +
                "`!ban @membre [raison]`\n" +
                "`!unban <id> [raison]`\n" +
                "`!kick @membre [raison]`\n" +
                "`!timeout @membre [durée] [raison]` (`!mute`)\n" +
                "`!untimeout @membre` (`!unmute`)\n" +
                "`!warn @membre [raison]`\n" +
                "`!warnings @membre`\n" +
                "`!softban @membre [raison]` — purge 24h sans ban définitif\n" +
                "`!nick @membre [pseudo|reset]`\n" +
                "`!purge 1-100` (`!clear`)\n" +
                "`!slowmode <secondes>`";
        }

        if (isAdmin) {
            text +=
                "\n\n**Sécurité (admin)**\n" +
                "`!config` — Raid, nuke, spam, quarantaine\n" +
                "`!securitylogs` — Salon de logs Dyno / Wick\n" +
                "`!lockdown` / `!unlock`\n" +
                "`!antinuke` / `!whitelist`\n" +
                "`!cases` — Dossiers de modération\n" +
                "`!setupcheck` — Vérification du serveur";
        }

        return message.reply(text);
    }
};
