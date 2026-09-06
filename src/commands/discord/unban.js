const {
    PermissionFlagsBits
} = require("discord.js");

const {
    parseUserId,
    extractReason,
    recordAndLog
} = require("../../moderation/helpers");

module.exports = {
    name: "unban",
    description: "Révoque un bannissement",
    permission: PermissionFlagsBits.BanMembers,

    async execute(message, args) {
        if (!message.guild) {
            return message.reply("❌ Utilise cette commande sur un serveur.");
        }

        const userId = parseUserId(args.shift());

        if (!userId) {
            return message.reply("Usage : `!unban <id> [raison]`");
        }

        const ban = await message.guild.bans.fetch(userId).catch(() => null);

        if (!ban) {
            return message.reply("❌ Cet utilisateur n'est pas banni.");
        }

        const reason = extractReason(args);

        await message.guild.members.unban(userId, `${message.author.tag}: ${reason}`);

        const caseId = await recordAndLog(message.guild, {
            target: ban.user,
            actor: message.author,
            title: "Member Unbanned",
            level: "warning",
            caseType: "moderation",
            action: "unban",
            reason
        });

        return message.reply(
            `♻️ **${ban.user.tag}** n'est plus banni.${caseId ? ` Dossier \`#${caseId}\`.` : ""}`
        );
    }
};
