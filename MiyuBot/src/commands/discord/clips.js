const { ChannelType, PermissionFlagsBits } = require("discord.js");

const { setupClipsChannel } = require("../../discord/clipsChannel");

module.exports = {
    name: "clips",
    description: "Crée le salon #clips pour les clips Twitch",
    permission: PermissionFlagsBits.ManageGuild,

    async execute(message, args) {
        if (!message.guild) {
            return message.reply(
                "❌ Cette commande doit être utilisée sur un serveur."
            );
        }

        let preferred = null;
        const id = args.find((value) => /^\d{17,22}$/.test(String(value)));

        if (id) {
            preferred =
                message.guild.channels.cache.get(id) ||
                await message.guild.channels.fetch(id).catch(() => null);
        }

        if (
            preferred &&
            preferred.type !== ChannelType.GuildText &&
            preferred.type !== ChannelType.GuildAnnouncement
        ) {
            preferred = null;
        }

        return message.reply(
            await setupClipsChannel(message.guild, preferred)
        );
    }
};
