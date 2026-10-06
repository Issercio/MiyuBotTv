const {
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const {
    closeTicket,
    postTicketPanel,
    saveTicketSetup
} = require("../../discord/tickets");

function snowflakeIds(args) {
    return args
        .slice(1)
        .map((value) => String(value))
        .filter((value) => /^\d{17,22}$/.test(value));
}

module.exports = {
    name: "ticket",
    description: "Tickets support (panneau, rôle staff, fermeture)",
    permission: PermissionFlagsBits.ManageGuild,

    async execute(message, args) {
        if (!message.guild) {
            return message.reply(
                "❌ Cette commande doit être utilisée sur un serveur."
            );
        }

        const action = String(args[0] || "").toLowerCase();

        if (!action || action === "help") {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("🎫 Tickets MiyuBot")
                .setDescription(
                    "Panneau avec bouton, salon privé, fermeture par le staff ou la personne qui a ouvert."
                )
                .addFields(
                    {
                        name: "1. Rôle staff (recommandé)",
                        value: "`/ticket setup` + option **role**",
                        inline: false
                    },
                    {
                        name: "2. Salon du bouton",
                        value: "`/ticket panel` crée **#ouvrir-ticket** tout seul, avec le bouton",
                        inline: false
                    },
                    {
                        name: "3. Fermer",
                        value: "Bouton **Fermer le ticket**, ou `/ticket close` dans le salon",
                        inline: false
                    }
                )
                .setFooter({
                    text: "MiyuBot a besoin de Gérer les salons"
                });

            return message.reply({ embeds: [embed] });
        }

        if (action === "panel") {
            return message.reply(await postTicketPanel(message.guild));
        }

        if (action === "setup") {
            let categoryChannel = null;
            let staffRole = message.mentions?.roles?.first
                ? message.mentions.roles.first()
                : null;

            for (const id of snowflakeIds(args)) {
                const channel =
                    message.guild.channels.cache.get(id) ||
                    null;

                if (channel) {
                    categoryChannel = channel;
                }

                const role = message.guild.roles.cache.get(id);

                if (role) {
                    staffRole = role;
                }
            }

            return message.reply(
                await saveTicketSetup(
                    message.guild,
                    categoryChannel,
                    staffRole
                )
            );
        }

        if (action === "close") {
            return message.reply(
                await closeTicket(message.channel, message.member)
            );
        }

        return message.reply(
            "❌ Actions : `panel`, `setup`, `close`."
        );
    }
};
