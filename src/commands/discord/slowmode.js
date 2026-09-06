const {
    PermissionFlagsBits
} = require("discord.js");

const {
    sendSecurityLog
} = require("../../security/securityLogger");

module.exports = {
    name: "slowmode",
    aliases: ["slow"],
    description: "Active le mode lent du salon",
    permission: PermissionFlagsBits.ManageChannels,

    async execute(message, args) {
        if (!message.guild || !message.channel?.setRateLimitPerUser) {
            return message.reply("❌ Utilise cette commande dans un salon texte.");
        }

        const seconds = Math.min(
            21600,
            Math.max(0, Number.parseInt(args[0], 10))
        );

        if (!Number.isInteger(seconds)) {
            return message.reply("Usage : `!slowmode 0-21600` (secondes). `0` pour désactiver.");
        }

        await message.channel.setRateLimitPerUser(
            seconds,
            `${message.author.tag} via !slowmode`
        );

        await sendSecurityLog(message.guild, {
            title: "Slowmode Updated",
            level: "info",
            actor: message.author,
            fields: [
                {
                    name: "Channel",
                    value: `<#${message.channel.id}>`,
                    inline: true
                },
                {
                    name: "Seconds",
                    value: String(seconds),
                    inline: true
                }
            ]
        });

        if (seconds === 0) {
            return message.reply("🐢 Mode lent désactivé.");
        }

        return message.reply(`🐢 Mode lent : **${seconds}s** entre chaque message.`);
    }
};
