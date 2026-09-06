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
    name: "softban",
    description: "Ban + unban pour supprimer les messages sans bannir définitivement",
    permission: PermissionFlagsBits.BanMembers,

    async execute(message, args) {
        if (!message.guild) {
            return message.reply("❌ Utilise cette commande sur un serveur.");
        }

        const { member, user, userId } = await resolveMember(message, args.shift());

        if (!userId || !user) {
            return message.reply("Usage : `!softban @membre [raison]`");
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
            reason: `${message.author.tag} (softban): ${reason}`
        });

        await message.guild.members.unban(
            userId,
            `${message.author.tag} (softban reverse)`
        );

        const caseId = await recordAndLog(message.guild, {
            target: user,
            actor: message.author,
            title: "Member Softbanned",
            level: "danger",
            caseType: "moderation",
            action: "softban",
            reason
        });

        return message.reply(
            `🧹 **${user.tag}** a été softban (messages 24h purgés, pas banni).${caseId ? ` Dossier \`#${caseId}\`.` : ""}`
        );
    }
};
