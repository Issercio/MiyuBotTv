const {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const {
    run,
    get,
    all,
    databaseReady
} = require("../database/database");

const { getSecurityLogChannel } = require("../security/securityLogger");

const OPEN_BUTTON_ID = "miyu_ticket_open";
const CLOSE_BUTTON_ID = "miyu_ticket_close";
const CLAIM_BUTTON_ID = "miyu_ticket_claim";
const MAX_OPEN_TICKETS = 50;
const DISCORD_CATEGORY_LIMIT = 50;
const TICKET_EMBED_COLOR = 0xc47aff;

const TICKET_TYPES = {
    support: {
        key: "support",
        label: "Support",
        prefix: "support",
        emoji: "🛠️",
        buttonId: "miyu_ticket_open_support"
    },
    collab: {
        key: "collab",
        label: "Collab",
        prefix: "collab",
        emoji: "🤝",
        buttonId: "miyu_ticket_open_collab"
    },
    signalement: {
        key: "signalement",
        label: "Signalement",
        prefix: "signalement",
        emoji: "⚠️",
        buttonId: "miyu_ticket_open_signalement"
    }
};

const OPEN_BUTTON_TYPES = {
    [OPEN_BUTTON_ID]: "support",
    [TICKET_TYPES.support.buttonId]: "support",
    [TICKET_TYPES.collab.buttonId]: "collab",
    [TICKET_TYPES.signalement.buttonId]: "signalement"
};

function ticketTypeInfo(key) {
    return TICKET_TYPES[key] || TICKET_TYPES.support;
}

function typeLabel(ticket) {
    return ticketTypeInfo(ticket?.ticket_type).label;
}

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

function ticketChannelName(user, typeKey) {
    const prefix = ticketTypeInfo(typeKey).prefix;
    const raw = String(user.username || "membre")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 18);

    return `${prefix}-${raw || "membre"}`;
}

function closeButton() {
    return new ButtonBuilder()
        .setCustomId(CLOSE_BUTTON_ID)
        .setLabel("Fermer le ticket")
        .setStyle(ButtonStyle.Danger);
}

function claimButton(claimed) {
    return new ButtonBuilder()
        .setCustomId(CLAIM_BUTTON_ID)
        .setLabel(claimed ? "Pris en charge" : "Je m'en occupe")
        .setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(Boolean(claimed));
}

function ticketActionRow(claimed) {
    return new ActionRowBuilder().addComponents(
        claimButton(claimed),
        closeButton()
    );
}

function openButtonRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(TICKET_TYPES.support.buttonId)
            .setLabel(TICKET_TYPES.support.label)
            .setEmoji(TICKET_TYPES.support.emoji)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(TICKET_TYPES.collab.buttonId)
            .setLabel(TICKET_TYPES.collab.label)
            .setEmoji(TICKET_TYPES.collab.emoji)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(TICKET_TYPES.signalement.buttonId)
            .setLabel(TICKET_TYPES.signalement.label)
            .setEmoji(TICKET_TYPES.signalement.emoji)
            .setStyle(ButtonStyle.Danger)
    );
}

function isTicketStaff(member, staffRoleId) {
    if (!member) {
        return false;
    }

    if (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageChannels)
    ) {
        return true;
    }

    return Boolean(staffRoleId && member.roles.cache.has(staffRoleId));
}

function canCloseTicket(member, ticket, staffRoleId) {
    if (!member) {
        return false;
    }

    if (ticket && ticket.user_id === member.id) {
        return true;
    }

    return isTicketStaff(member, staffRoleId);
}

function buildTicketOverwrites(guild, userId, staffRoleId) {
    const overwrites = [
        {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
        },
        {
            id: userId,
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
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles
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

    return overwrites;
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
        topic: "Ouvre un ticket pour parler au staff en privé.",
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
            "Les membres choisissent **Support**, **Collab** ou **Signalement**."
    };
}

async function sweepAndCountOpenTickets(guild) {
    const rows = await all(
        `
        SELECT *
        FROM tickets
        WHERE guild_id = ?
        AND status = 'open'
        `,
        [guild.id]
    );

    let live = 0;

    for (const row of rows) {
        if (guild.channels.cache.get(row.channel_id)) {
            live += 1;
            continue;
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
            [Date.now(), "stale", row.id]
        );
    }

    return live;
}

function categoryHasRoom(category) {
    return Boolean(
        category &&
        category.children.cache.size < DISCORD_CATEGORY_LIMIT
    );
}

async function findTicketCategoryWithRoom(guild, settings) {
    const primary = await ensureTicketCategory(guild, settings);

    if (categoryHasRoom(primary)) {
        return primary;
    }

    const overflow = guild.channels.cache.filter(
        (channel) =>
            channel.type === ChannelType.GuildCategory &&
            channel.id !== primary.id &&
            /^Tickets(?: \d+)?$/i.test(channel.name)
    );

    for (const category of overflow.values()) {
        if (categoryHasRoom(category)) {
            return category;
        }
    }

    return guild.channels.create({
        name: `Tickets ${overflow.size + 2}`,
        type: ChannelType.GuildCategory,
        reason: "MiyuBot tickets"
    });
}

function uniqueTicketChannelName(guild, user, typeKey) {
    const base = ticketChannelName(user, typeKey);

    if (
        !guild.channels.cache.some(
            (channel) => channel.name === base
        )
    ) {
        return base;
    }

    for (let index = 2; index < 50; index += 1) {
        const name = `${base}-${index}`.slice(0, 95);

        if (
            !guild.channels.cache.some(
                (channel) => channel.name === name
            )
        ) {
            return name;
        }
    }

    return `${base}-${Date.now().toString(36).slice(-4)}`;
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

async function openTicket(guild, user, typeKey) {
    const type = ticketTypeInfo(typeKey);
    const settings = await ensureGuildSettings(guild.id);
    const openCount = await sweepAndCountOpenTickets(guild);

    if (openCount >= MAX_OPEN_TICKETS) {
        return {
            content:
                "Impossible d’ouvrir un ticket pour le moment. Réessaie un peu plus tard."
        };
    }

    const category = await findTicketCategoryWithRoom(guild, settings);
    const staffRoleId = settings.ticket_staff_role_id || null;
    const overwrites = buildTicketOverwrites(
        guild,
        user.id,
        staffRoleId
    );

    const channel = await guild.channels.create({
        name: uniqueTicketChannelName(guild, user, type.key),
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: overwrites,
        topic: `Ticket ${type.label} de ${user.tag} (${user.id})`,
        reason: `Ticket MiyuBot — ${type.label} — ${user.tag}`
    });

    const inserted = await run(
        `
        INSERT INTO tickets (
            guild_id,
            channel_id,
            user_id,
            opened_at,
            status,
            ticket_type
        )
        VALUES (?, ?, ?, ?, 'open', ?)
        `,
        [guild.id, channel.id, user.id, Date.now(), type.key]
    );

    const ticketId = inserted.lastID;

    const pingLine = staffRoleId
        ? `${user} <@&${staffRoleId}>`
        : `${user}`;

    await channel.send({
        content: pingLine,
        embeds: [
            new EmbedBuilder()
                .setColor(TICKET_EMBED_COLOR)
                .setTitle(`🎫 Ticket #${ticketId} — ${type.label}`)
                .setDescription(
                    "Explique clairement ton problème ou ta demande.\n" +
                    "Un membre du staff te répondra ici, en privé.\n\n" +
                    "La conversation est **sauvegardée** à la fermeture. " +
                    "Le staff peut la rouvrir avec `/ticket reopen`.\n\n" +
                    "Staff : **Je m'en occupe** pour prendre le ticket.\n" +
                    "Quand c’est réglé, clique sur **Fermer le ticket**."
                )
                .addFields(
                    {
                        name: "Type",
                        value: type.label,
                        inline: true
                    },
                    {
                        name: "Ouvert par",
                        value: `${user} (\`${user.id}\`)`,
                        inline: true
                    }
                )
                .setFooter({
                    text: "MiyuBot • Tickets Kitsunara"
                })
                .setTimestamp()
        ],
        components: [ticketActionRow(false)]
    });

    return {
        content: `🎫 Ton ticket **${type.label}** est prêt : ${channel}`
    };
}

async function collectTranscript(channel) {
    const collected = [];
    let before;

    for (let page = 0; page < 8; page += 1) {
        const options = { limit: 100 };

        if (before) {
            options.before = before;
        }

        const batch = await channel.messages.fetch(options);

        if (!batch.size) {
            break;
        }

        collected.push(...batch.values());
        before = batch.last().id;

        if (batch.size < 100) {
            break;
        }
    }

    collected.sort(
        (left, right) =>
            left.createdTimestamp - right.createdTimestamp
    );

    if (!collected.length) {
        return "Aucun message.";
    }

    return collected
        .map((message) => {
            const time = new Date(message.createdTimestamp).toISOString();
            const name =
                message.author?.tag ||
                message.author?.username ||
                "inconnu";
            const text =
                message.content ||
                message.embeds[0]?.description ||
                "";
            const files = [...message.attachments.values()]
                .map((file) => file.url)
                .join(" ");

            return `[${time}] ${name}: ${text}${files ? ` ${files}` : ""}`.trim();
        })
        .join("\n");
}

function transcriptAttachment(ticketId, transcript) {
    return new AttachmentBuilder(
        Buffer.from(transcript || "Aucun message.", "utf8"),
        { name: `ticket-${ticketId}.txt` }
    );
}

async function sendTranscriptToLogs(guild, ticket, member, transcript) {
    try {
        const logChannel = await getSecurityLogChannel(guild);

        if (!logChannel) {
            return;
        }

        const fields = [
            {
                name: "Type",
                value: typeLabel(ticket),
                inline: true
            },
            {
                name: "Ouvert par",
                value: `<@${ticket.user_id}>`,
                inline: true
            },
            {
                name: "Fermé par",
                value: `${member}`,
                inline: true
            }
        ];

        if (ticket.claimed_by) {
            fields.push({
                name: "Pris en charge par",
                value: `<@${ticket.claimed_by}>`,
                inline: true
            });
        }

        await logChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xed4245)
                    .setTitle(`🎫 Ticket #${ticket.id} fermé`)
                    .setDescription(
                        "Transcript en pièce jointe.\n" +
                        `Rouvrir : \`/ticket reopen\` numéro **${ticket.id}**.`
                    )
                    .addFields(fields)
                    .setFooter({
                        text: "MiyuBot • Tickets Kitsunara"
                    })
                    .setTimestamp()
            ],
            files: [transcriptAttachment(ticket.id, transcript)]
        });
    } catch (error) {
        console.error("❌ Log transcript ticket :", error);
    }
}

async function claimTicket(channel, member) {
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

    if (!isTicketStaff(member, settings.ticket_staff_role_id)) {
        return {
            content: "❌ Seul le staff peut prendre un ticket."
        };
    }

    if (ticket.claimed_by) {
        if (ticket.claimed_by === member.id) {
            return {
                content: "Tu as déjà pris ce ticket.",
                claimed: true
            };
        }

        return {
            content: `Déjà pris en charge par <@${ticket.claimed_by}>.`,
            claimed: true
        };
    }

    await run(
        `
        UPDATE tickets
        SET claimed_by = ?
        WHERE id = ?
        `,
        [member.id, ticket.id]
    );

    await channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(0x57f287)
                .setTitle(`🎫 Ticket #${ticket.id} pris en charge`)
                .setDescription(`${member} s’en occupe.`)
        ]
    }).catch(() => null);

    return {
        content: `Ticket #${ticket.id} pris en charge.`,
        claimed: true
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

    let transcript = "Aucun message.";

    try {
        transcript = await collectTranscript(channel);
    } catch (error) {
        console.error("❌ Transcript ticket :", error);
    }

    await run(
        `
        UPDATE tickets
        SET
            status = 'closed',
            closed_at = ?,
            closed_by = ?,
            transcript = ?
        WHERE id = ?
        `,
        [Date.now(), member.id, transcript, ticket.id]
    );

    await sendTranscriptToLogs(
        channel.guild,
        ticket,
        member,
        transcript
    );

    await channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle(`🎫 Ticket #${ticket.id} fermé`)
                .setDescription(
                    `Fermé par ${member}. Conversation sauvegardée` +
                    " (copie envoyée dans les logs si le salon est configuré).\n" +
                    `Rouvrir : \`/ticket reopen\` + numéro **${ticket.id}**.\n` +
                    "Le salon sera supprimé dans 5 secondes."
                )
        ]
    }).catch(() => null);

    setTimeout(() => {
        channel.delete("Ticket MiyuBot fermé").catch(() => null);
    }, 5000);

    return {
        content:
            `🎫 Ticket #${ticket.id} fermé et sauvegardé. ` +
            `Rouvrir : \`/ticket reopen\` numéro ${ticket.id}.`
    };
}

async function listClosedTickets(guild) {
    const rows = await all(
        `
        SELECT id, user_id, closed_at, ticket_type, claimed_by
        FROM tickets
        WHERE guild_id = ?
        AND status = 'closed'
        ORDER BY closed_at DESC
        LIMIT 15
        `,
        [guild.id]
    );

    if (!rows.length) {
        return {
            content: "Aucun ticket sauvegardé pour l’instant."
        };
    }

    const lines = rows.map((row) => {
        const when = row.closed_at
            ? `<t:${Math.floor(Number(row.closed_at) / 1000)}:R>`
            : "—";
        const claimed = row.claimed_by
            ? ` — staff <@${row.claimed_by}>`
            : "";

        return (
            `**#${row.id}** · ${typeLabel(row)} — <@${row.user_id}>` +
            ` — fermé ${when}${claimed}`
        );
    });

    return {
        embeds: [
            new EmbedBuilder()
                .setColor(TICKET_EMBED_COLOR)
                .setTitle("🎫 Tickets sauvegardés")
                .setDescription(
                    lines.join("\n") +
                    "\n\nRouvrir : `/ticket reopen` + le **numéro**."
                )
        ]
    };
}

async function reopenTicket(guild, member, ticketId) {
    const id = Number(ticketId);

    if (!Number.isInteger(id) || id < 1) {
        return {
            content: "❌ Indique le numéro du ticket (`/ticket list`)."
        };
    }

    const settings = await ensureGuildSettings(guild.id);
    const ticket = await get(
        `
        SELECT *
        FROM tickets
        WHERE id = ?
        AND guild_id = ?
        LIMIT 1
        `,
        [id, guild.id]
    );

    if (!ticket) {
        return {
            content: "❌ Ticket introuvable."
        };
    }

    if (ticket.status === "open") {
        const existing = guild.channels.cache.get(ticket.channel_id);

        if (existing) {
            return {
                content: `Ce ticket est déjà ouvert : ${existing}`
            };
        }
    }

    if (!canCloseTicket(member, ticket, settings.ticket_staff_role_id)) {
        return {
            content: "❌ Tu ne peux pas rouvrir ce ticket."
        };
    }

    const openCount = await sweepAndCountOpenTickets(guild);

    if (openCount >= MAX_OPEN_TICKETS) {
        return {
            content:
                "Impossible d’ouvrir un ticket pour le moment. Réessaie un peu plus tard."
        };
    }

    const opener =
        await guild.members.fetch(ticket.user_id).catch(() => null);
    const user = opener?.user || { id: ticket.user_id, tag: ticket.user_id };
    const category = await findTicketCategoryWithRoom(guild, settings);
    const staffRoleId = settings.ticket_staff_role_id || null;
    const type = ticketTypeInfo(ticket.ticket_type);

    const channel = await guild.channels.create({
        name: uniqueTicketChannelName(guild, user, type.key),
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: buildTicketOverwrites(
            guild,
            ticket.user_id,
            staffRoleId
        ),
        topic: `Ticket #${ticket.id} ${type.label} rouvert (${ticket.user_id})`,
        reason: `Réouverture ticket #${ticket.id}`
    });

    await run(
        `
        UPDATE tickets
        SET
            status = 'open',
            channel_id = ?,
            closed_at = NULL,
            closed_by = NULL
        WHERE id = ?
        `,
        [channel.id, ticket.id]
    );

    const pingLine = staffRoleId
        ? `<@${ticket.user_id}> <@&${staffRoleId}>`
        : `<@${ticket.user_id}>`;

    const claimed = Boolean(ticket.claimed_by);
    const fields = [
        {
            name: "Type",
            value: type.label,
            inline: true
        },
        {
            name: "Ouvert par",
            value: `<@${ticket.user_id}>`,
            inline: true
        }
    ];

    if (claimed) {
        fields.push({
            name: "Pris en charge par",
            value: `<@${ticket.claimed_by}>`,
            inline: true
        });
    }

    await channel.send({
        content: pingLine,
        embeds: [
            new EmbedBuilder()
                .setColor(TICKET_EMBED_COLOR)
                .setTitle(`🎫 Ticket #${ticket.id} rouvert — ${type.label}`)
                .setDescription(
                    `Rouvert par ${member}. L’historique est en fichier ci-dessous.`
                )
                .addFields(fields)
        ],
        files: [transcriptAttachment(ticket.id, ticket.transcript)],
        components: [ticketActionRow(claimed)]
    });

    return {
        content: `🎫 Ticket #${ticket.id} rouvert : ${channel}`
    };
}

function panelPayload() {
    return {
        embeds: [
            new EmbedBuilder()
                .setColor(TICKET_EMBED_COLOR)
                .setTitle("🎫 Tickets Kitsunara")
                .setDescription(
                    "Choisis le type de ticket :\n\n" +
                    "🛠️ **Support** — un souci, une question, de l’aide\n" +
                    "🤝 **Collab** — proposition, partenariat, projet\n" +
                    "⚠️ **Signalement** — comportement, raid, contenu à signaler\n\n" +
                    "Un salon **privé** sera créé : toi + l’équipe, personne d’autre."
                )
                .setFooter({
                    text: "MiyuBot • Support Kitsunara"
                })
        ],
        components: [openButtonRow()]
    };
}

async function saveTicketSetup(guild, category, staffRole) {
    await ensureGuildSettings(guild.id);

    if (category && category.type === ChannelType.GuildCategory) {
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
            "Ensuite : `/ticket panel` — ça crée le salon **#ouvrir-ticket** avec les 3 boutons."
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

    const openType = OPEN_BUTTON_TYPES[interaction.customId];

    if (openType) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await openTicket(
                interaction.guild,
                interaction.user,
                openType
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

    if (interaction.customId === CLAIM_BUTTON_ID) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await claimTicket(
                interaction.channel,
                interaction.member
            );

            if (result.claimed) {
                await interaction.message.edit({
                    components: [ticketActionRow(true)]
                }).catch(() => null);
            }

            return interaction.editReply(result);
        } catch (error) {
            console.error("❌ Erreur claim ticket :", error);

            return interaction.editReply({
                content: "❌ Impossible de prendre ce ticket."
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
        Boolean(
            OPEN_BUTTON_TYPES[interaction.customId] ||
            interaction.customId === CLOSE_BUTTON_ID ||
            interaction.customId === CLAIM_BUTTON_ID
        )
    );
}

module.exports = {
    closeTicket,
    handleTicketButton,
    isTicketButton,
    listClosedTickets,
    panelPayload,
    postTicketPanel,
    reopenTicket,
    saveTicketSetup
};
