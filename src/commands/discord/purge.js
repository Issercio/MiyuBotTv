const {
    PermissionFlagsBits
} = require("discord.js");

const {
    sendSecurityLog
} = require("../../security/securityLogger");

module.exports = {
    name: "purge",
    aliases: ["clear", "prune"],
    description: "Supprime des messages dans le salon",
    permission: PermissionFlagsBits.ManageMessages,

    async execute(message, args) {
        if (!message.guild || !message.channel) {
            return message.reply("❌ Utilise cette commande dans un salon.");
        }

        if (!message.channel.bulkDelete) {
            return message.reply("❌ Impossible de purger ce type de salon.");
        }

        const amount = Math.min(100, Math.max(1, Number.parseInt(args[0], 10)));

        if (!Number.isInteger(amount)) {
            return message.reply("Usage : `!purge 1-100`");
        }

        await message.delete().catch(() => null);

        const deleted = await message.channel.bulkDelete(amount, true);

        await sendSecurityLog(message.guild, {
            title: "Messages Purged",
            level: "warning",
            actor: message.author,
            fields: [
                {
                    name: "Channel",
                    value: `<#${message.channel.id}>`,
                    inline: true
                },
                {
                    name: "Deleted",
                    value: String(deleted.size),
                    inline: true
                }
            ]
        });

        const confirm = await message.channel.send(
            `🧹 ${deleted.size} message(s) supprimé(s).`
        );

        setTimeout(() => {
            confirm.delete().catch(() => null);
        }, 4000);
    }
};
