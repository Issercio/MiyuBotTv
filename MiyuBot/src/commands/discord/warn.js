const {
    PermissionFlagsBits
} = require("discord.js");

const {
    resolveMember,
    extractReason,
    recordAndLog
} = require("../../moderation/helpers");

const {
    addWarning,
    countWarnings
} = require("../../database/database");

module.exports = {
    name: "warn",
    description: "Avertit un membre",
    permission: PermissionFlagsBits.ModerateMembers,

    async execute(message, args) {
        if (!message.guild) {
            return message.reply("❌ Utilise cette commande sur un serveur.");
        }

        const { user, userId } = await resolveMember(message, args.shift());

        if (!userId || !user) {
            return message.reply("Usage : `!warn @membre [raison]`");
        }

        if (user.id === message.author.id) {
            return message.reply("❌ Tu ne peux pas t'avertir toi-même.");
        }

        const reason = extractReason(args);
        await addWarning(message.guild.id, user.id, message.author.id, reason);
        const total = await countWarnings(message.guild.id, user.id);

        const caseId = await recordAndLog(message.guild, {
            target: user,
            actor: message.author,
            title: "Member Warned",
            level: "warning",
            caseType: "moderation",
            action: "warn",
            reason,
            fields: [
                {
                    name: "Warnings",
                    value: String(total),
                    inline: true
                }
            ]
        });

        await user.send(
            `⚠️ Tu as reçu un avertissement sur **${message.guild.name}**.\nRaison : ${reason}\nTotal : ${total}`
        ).catch(() => null);

        return message.reply(
            `⚠️ **${user.tag}** a été averti (${total} warn).${caseId ? ` Dossier \`#${caseId}\`.` : ""}`
        );
    }
};
