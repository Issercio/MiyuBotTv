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
    name: "ban",
    description: "Bannit un membre",
    permission: PermissionFlagsBits.BanMembers,

    async execute(message, args) {
        if (!message.guild) {
            return message.reply("❌ Utilise cette commande sur un serveur.");
        }

        const { member, user, userId } = await resolveMember(message, args.shift());

        if (!userId || !user) {
            return message.reply("Usage : `/ban` + membre");
        }

        if (member) {
            const hierarchy = canActOn(message.member, member);

            if (!hierarchy.ok) {
                return message.reply(`❌ ${hierarchy.error}`);
            }

            const botCheck = botCanAct(member, "ban");

            if (!botCheck.ok) {
                return message.reply(`❌ ${botCheck.error}`);
            }
        }

        const reason = extractReason(args);

        await message.guild.members.ban(userId, {
            deleteMessageSeconds: 86400,
            reason: `${message.author.tag}: ${reason}`
        });

        const caseId = await recordAndLog(message.guild, {
            target: user,
            actor: message.author,
            title: "Member Banned",
            level: "danger",
            caseType: "moderation",
            action: "ban",
            reason
        });

        return message.reply(
            `🔨 **${user.tag}** a été banni.${caseId ? ` Dossier \`#${caseId}\`.` : ""}`
        );
    }
};
