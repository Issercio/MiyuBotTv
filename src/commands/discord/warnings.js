const {
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const {
    resolveMember
} = require("../../moderation/helpers");

const {
    listWarnings,
    countWarnings
} = require("../../database/database");

module.exports = {
    name: "warnings",
    aliases: ["warns"],
    description: "Liste les avertissements d'un membre",
    permission: PermissionFlagsBits.ModerateMembers,

    async execute(message, args) {
        if (!message.guild) {
            return message.reply("❌ Utilise cette commande sur un serveur.");
        }

        const { user, userId } = await resolveMember(
            message,
            args.shift() || message.author.id
        );

        if (!userId || !user) {
            return message.reply("Usage : `!warnings @membre`");
        }

        const rows = await listWarnings(message.guild.id, user.id, 10);
        const total = await countWarnings(message.guild.id, user.id);

        if (!rows.length) {
            return message.reply(`ℹ️ **${user.tag}** n'a aucun avertissement actif.`);
        }

        const embed = new EmbedBuilder()
            .setColor(0xFAA61A)
            .setAuthor({
                name: `Avertissements — ${user.tag}`,
                iconURL: user.displayAvatarURL({ size: 64 })
            })
            .setDescription(
                rows.map((row) => {
                    const when = Math.floor(Number(row.created_at) / 1000);
                    return `**#${row.id}** • <@${row.moderator_id}> • <t:${when}:R>\n${row.reason || "Sans raison"}`;
                }).join("\n\n").slice(0, 4000)
            )
            .setFooter({
                text: `${total} avertissement(s) actif(s)`
            });

        return message.reply({ embeds: [embed] });
    }
};
