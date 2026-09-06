const {
    PermissionFlagsBits
} = require("discord.js");

const {
    resolveMember,
    canActOn,
    botCanAct,
    extractReason,
    recordAndLog
} = require("../../moderation/helpers");

module.exports = {
    name: "untimeout",
    aliases: ["unmute"],
    description: "Retire un timeout",
    permission: PermissionFlagsBits.ModerateMembers,

    async execute(message, args) {
        if (!message.guild) {
            return message.reply("❌ Utilise cette commande sur un serveur.");
        }

        const { member, user } = await resolveMember(message, args.shift());

        if (!member || !user) {
            return message.reply("Usage : `!untimeout @membre [raison]`");
        }

        if (!member.communicationDisabledUntilTimestamp) {
            return message.reply("❌ Ce membre n'est pas en timeout.");
        }

        const hierarchy = canActOn(message.member, member);

        if (!hierarchy.ok) {
            return message.reply(`❌ ${hierarchy.error}`);
        }

        const botCheck = botCanAct(member, "timeout");

        if (!botCheck.ok) {
            return message.reply(`❌ ${botCheck.error}`);
        }

        const reason = extractReason(args);

        await member.timeout(null, `${message.author.tag}: ${reason}`);

        const caseId = await recordAndLog(message.guild, {
            target: user,
            actor: message.author,
            title: "Timeout Removed",
            level: "success",
            caseType: "moderation",
            action: "untimeout",
            reason
        });

        return message.reply(
            `✅ Timeout retiré pour **${user.tag}**.${caseId ? ` Dossier \`#${caseId}\`.` : ""}`
        );
    }
};
