const {
    PermissionFlagsBits
} = require("discord.js");

const {
    resolveMember,
    canActOn,
    botCanAct,
    parseDurationMs,
    formatDuration,
    extractReason,
    recordAndLog
} = require("../../moderation/helpers");

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

module.exports = {
    name: "timeout",
    aliases: ["mute", "to"],
    description: "Timeout / mute un membre",
    permission: PermissionFlagsBits.ModerateMembers,

    async execute(message, args) {
        if (!message.guild) {
            return message.reply("❌ Utilise cette commande sur un serveur.");
        }

        const { member, user } = await resolveMember(message, args.shift());

        if (!member || !user) {
            return message.reply("Usage : `!timeout @membre [durée] [raison]`\nExemple : `!timeout @user 10m spam`");
        }

        const hierarchy = canActOn(message.member, member);

        if (!hierarchy.ok) {
            return message.reply(`❌ ${hierarchy.error}`);
        }

        const botCheck = botCanAct(member, "timeout");

        if (!botCheck.ok) {
            return message.reply(`❌ ${botCheck.error}`);
        }

        let durationMs = parseDurationMs(args[0], null);

        if (durationMs !== null) {
            args.shift();
        } else {
            durationMs = 10 * 60 * 1000;
        }

        durationMs = Math.min(MAX_TIMEOUT_MS, Math.max(5000, durationMs));

        const reason = extractReason(args);

        await member.timeout(durationMs, `${message.author.tag}: ${reason}`);

        const caseId = await recordAndLog(message.guild, {
            target: user,
            actor: message.author,
            title: "Member Timed Out",
            level: "warning",
            caseType: "moderation",
            action: "timeout",
            reason,
            fields: [
                {
                    name: "Duration",
                    value: formatDuration(durationMs),
                    inline: true
                }
            ]
        });

        return message.reply(
            `⏱️ **${user.tag}** est en timeout ${formatDuration(durationMs)}.${caseId ? ` Dossier \`#${caseId}\`.` : ""}`
        );
    }
};
