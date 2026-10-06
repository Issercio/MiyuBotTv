const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const {
    run,
    get,
    databaseReady
} = require("../database/database");

const OPEN_BUTTON_ID = "miyu_ticket_open";
const CLOSE_BUTTON_ID = "miyu_ticket_close";

async function ensureGuildSettings(guildId) {
    await databaseReady;

    const existing = await get(
        `
        SELECT *
        FROM guild_settings
        WHERE guild_id = ?
        `,
        [guildId]
    );

    if (existing) {
        return existing;
    }

    const now = Date.now();

    await run(
        `
        INSERT INTO guild_settings (
            guild_id,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?)
        `,
        [guildId, now, now]
    );

    return get(
        `
        SELECT *
        FROM guild_settings
        WHERE guild_id = ?
        `,
        [guildId]
    );
}

function ticketChannelName(user) {
    const raw = String(user.username || "membre")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 18);

    return `ticket-${raw || "membre"}`;
}

function closeButtonRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(CLOSE_BUTTON_ID)
            .setLabel("Fermer le ticket")
            .setStyle(ButtonStyle.Danger)
    );
}

function openButtonRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(OPEN_BUTTON_ID)
            .setLabel("Ouvrir un ticket")
            .setEmoji("🎫")
            .setStyle(ButtonStyle.Primary)
    );
}

function canCloseTicket(member, ticket, staffRoleId) {
    if (!member) {
        return false;
    }

    if (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageChannels)
    ) {
        return true;
    }

    if (ticket && ticket.user_id === member.id) {
        return true;
    }

    if (staffRoleId && member.roles.cache.has(staffRoleId)) {
        return true;
    }

    return false;
}

async function ensureTicketCategory(guild, settings) {
    if (settings.ticket_category_id) {
        const existing = guild.channels.cache.get(
            settings.ticket_category_id
        );

        if (
            existing &&
            existing.type === ChannelType.GuildCategory
        ) {
            return existing;
        }
    }

    const created = await guild.channels.create({
        name: "Tickets",
        type: ChannelType.GuildCategory,
        reason: "MiyuBot tickets"
    });

    await run(
        `
        UPDATE guild_settings
        SET
            ticket_category_id = ?,
            updated_at = ?
        WHERE guild_id = ?
        `,
        [created.id, Date.now(), guild.id]
    );

    return created;
}

const PANEL_CHANNEL_NAME = "ouvrir-ticket";

async function savePanelChannelId(guildId, channelId) {
    await run(
        `
        UPDATE guild_settings
        SET
            ticket_panel_channel_id = ?,
            updated_at = ?
        WHERE guild_id = ?
        `,
        [channelId, Date.now(), guildId]
    );
}

async function ensureTicketPanelChannel(guild, settings) {
    if (settings.ticket_panel_channel_id) {
        const existing = guild.channels.cache.get(
            settings.ticket_panel_channel_id
        );

        if (
            existing &&
            existing.type === ChannelType.GuildText
        ) {
            return existing;
        }
    }

    const byName = guild.channels.cache.find(
        (channel) =>
            channel.type === ChannelType.GuildText &&
            channel.name === PANEL_CHANNEL_NAME
    );

    if (byName) {
        await savePanelChannelId(guild.id, byName.id);
        return byName;
    }

    const category = await ensureTicketCategory(guild, settings);

    const created = await guild.channels.create({
        name: PANEL_CHANNEL_NAME,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: "Clique sur le bouton pour ouvrir un ticket.",
        permissionOverwrites: [
            {
                id: guild.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.ReadMessageHistory
                ],
                deny: [PermissionFlagsBits.SendMessages]
            }
        ],
        reason: "MiyuBot salon d’ouverture des tickets"
    });

    await savePanelChannelId(guild.id, created.id);
    return created;
}

async function postTicketPanel(guild) {
    const settings = await ensureGuildSettings(guild.id);
    await ensureTicketCategory(guild, settings);
    const panelChannel = await ensureTicketPanelChannel(
        guild,
        await ensureGuildSettings(guild.id)
    );

    await panelChannel.send(panelPayload());

    return {
        content:
            `🎫 Salon créé (ou réutilisé) : ${panelChannel}\n` +
            "Les membres cliquent sur **Ouvrir un ticket** là-bas. " +
            "Leurs tickets privés apparaîtront dans la même catégorie."
    };
}

async function findOpenTicket(guildId, userId) {
    return get(
        `
        SELECT *
        FROM tickets
        WHERE guild_id = ?
        AND user_id = ?
        AND status = 'open'
        ORDER BY opened_at DESC
        LIMIT 1
        `,
        [guildId, userId]
    );
}

async function findTicketByChannel(channelId) {
    return get(
        `
        SELECT *
        FROM tickets
        WHERE channel_id = ?
        AND status = 'open'
        LIMIT 1
        `,
        [channelId]
    );
}

async function openTicket(guild, user, member) {
    const settings = await ensureGuildSettings(guild.id);
    const existing = await findOpenTicket(guild.id, user.id);

    if (existing) {
        const openChannel = guild.channels.cache.get(existing.channel_id);

        if (openChannel) {
            return {
                content: `Tu as déjà un ticket ouvert : ${openChannel}`
            };
        }

        await run(
            `
            UPDATE tickets
            SET
                status = 'closed',
                closed_at = ?,
                closed_by = ?
            WHERE id = ?
            `,
            [Date.now(), "stale", existing.id]
        );
    }

    const category = await ensureTicketCategory(guild, settings);
    const staffRoleId = settings.ticket_staff_role_id || null;
    const overwrites = [
        {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
        },
        {
            id: user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles
            ]
        }
    ];

    if (guild.members.me) {
        overwrites.push({
            id: guild.members.me.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.EmbedLinks
            ]
        });
    }

    if (staffRoleId) {
        overwrites.push({
            id: staffRoleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ManageMessages
            ]
        });
    }

    const channel = await guild.channels.create({
        name: ticketChannelName(user),
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: overwrites,
        topic: `Ticket de ${user.tag} (${user.id})`,
        reason: `Ticket MiyuBot — ${user.tag}`
    });

    await run(
        `
        INSERT INTO tickets (
            guild_id,
            channel_id,
            user_id,
            opened_at,
            status
        )
        VALUES (?, ?, ?, ?, 'open')
        `,
        [guild.id, channel.id, user.id, Date.now()]
    );

    const pingLine = staffRoleId
        ? `${user} <@&${staffRoleId}>`
        : `${user}`;

    await channel.send({
        content: pingLine,
        embeds: [
            new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("🎫 Ticket Kitsunara")
                .setDescription(
                    "Explique ton souci ici. Un membre du staff va te répondre.\n" +
                    "Quand c’est réglé, clique sur **Fermer le ticket**."
                )
                .addFields({
                    name: "Ouvert par",
                    value: `${user} (\`${user.id}\`)`,
                    inline: false
                })
                .setFooter({
                    text: "MiyuBot • Tickets"
                })
                .setTimestamp()
        ],
        components: [closeButtonRow()]
    });

    return {
        content: `🎫 Ton ticket est prêt : ${channel}`
    };
}

async function closeTicket(channel, member) {
    if (!channel || !channel.guild) {
        return {
            content: "❌ Utilise cette action dans un salon ticket."
        };
    }

    const settings = await ensureGuildSettings(channel.guild.id);
    const ticket = await findTicketByChannel(channel.id);

    if (!ticket) {
        return {
            content: "❌ Ce salon n’est pas un ticket ouvert."
        };
    }

    if (!canCloseTicket(member, ticket, settings.ticket_staff_role_id)) {
        return {
            content: "❌ Tu ne peux pas fermer ce ticket."
        };
    }

    await run(
        `
        UPDATE tickets
        SET
            status = 'closed',
            closed_at = ?,
            closed_by = ?
        WHERE id = ?
        `,
        [Date.now(), member.id, ticket.id]
    );

    await channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle("🎫 Ticket fermé")
                .setDescription(
                    `Fermé par ${member}. Le salon sera supprimé dans 5 secondes.`
                )
        ]
    }).catch(() => null);

    setTimeout(() => {
        channel.delete("Ticket MiyuBot fermé").catch(() => null);
    }, 5000);

    return {
        content: "🎫 Ticket fermé. Le salon disparaît dans 5 secondes."
    };
}

function panelPayload() {
    return {
        embeds: [
            new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("🎫 Tickets Kitsunara")
                .setDescription(
                    "Besoin du staff ? Clique sur le bouton pour ouvrir un **salon privé**.\n" +
                    "Seul toi et l’équipe pourrez le voir."
                )
                .setFooter({
                    text: "MiyuBot • Un ticket ouvert à la fois"
                })
        ],
        components: [openButtonRow()]
    };
}

async function saveTicketSetup(guild, category, staffRole) {
    await ensureGuildSettings(guild.id);

    if (category) {
        if (category.type !== ChannelType.GuildCategory) {
            category = null;
        }

        await run(
            `
            UPDATE guild_settings
            SET
                ticket_category_id = ?,
                updated_at = ?
            WHERE guild_id = ?
            `,
            [category.id, Date.now(), guild.id]
        );
    }

    if (staffRole) {
        await run(
            `
            UPDATE guild_settings
            SET
                ticket_staff_role_id = ?,
                updated_at = ?
            WHERE guild_id = ?
            `,
            [staffRole.id, Date.now(), guild.id]
        );
    }

    if (!category && !staffRole) {
        await ensureTicketCategory(
            guild,
            await ensureGuildSettings(guild.id)
        );
    }

    const settings = await ensureGuildSettings(guild.id);
    const categoryId = settings.ticket_category_id;
    const roleId = settings.ticket_staff_role_id;

    return {
        content:
            "🎫 Config tickets enregistrée.\n" +
            `Catégorie : ${categoryId ? `<#${categoryId}>` : "Tickets (auto)"}\n` +
            `Rôle staff : ${roleId ? `<@&${roleId}>` : "non défini (admins seulement)"}\n` +
            "Ensuite : `/ticket panel` — ça crée le salon **#ouvrir-ticket** avec le bouton."
    };
}

async function handleTicketButton(interaction) {
    if (!interaction.guild) {
        return interaction.reply({
            content: "❌ Les tickets marchent seulement sur un serveur.",
            ephemeral: true
        });
    }

    await databaseReady;

    if (interaction.customId === OPEN_BUTTON_ID) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await openTicket(
                interaction.guild,
                interaction.user,
                interaction.member
            );

            return interaction.editReply(result);
        } catch (error) {
            console.error("❌ Erreur ouverture ticket :", error);

            return interaction.editReply({
                content:
                    "❌ Impossible d’ouvrir le ticket. Vérifie que MiyuBot peut **gérer les salons**."
            });
        }
    }

    if (interaction.customId === CLOSE_BUTTON_ID) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await closeTicket(
                interaction.channel,
                interaction.member
            );

            return interaction.editReply(result);
        } catch (error) {
            console.error("❌ Erreur fermeture ticket :", error);

            return interaction.editReply({
                content: "❌ Impossible de fermer ce ticket."
            });
        }
    }
}

function isTicketButton(interaction) {
    return (
        interaction.isButton() &&
        (
            interaction.customId === OPEN_BUTTON_ID ||
            interaction.customId === CLOSE_BUTTON_ID
        )
    );
}

module.exports = {
    closeTicket,
    handleTicketButton,
    isTicketButton,
    panelPayload,
    postTicketPanel,
    saveTicketSetup
};
