const {
    ChannelType,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const {
    run,
    get,
    databaseReady
} = require("../../database/database");

const {
    sendSecurityLog
} = require("../../security/securityLogger");

const {
    applyStarterPreset
} = require("../../security/starterPreset");

module.exports = {
    name: "securitylogs",

    async execute(message, args) {
        await databaseReady;

        if (!message.guild) {
            return message.reply(
                "❌ Cette commande doit être utilisée sur un serveur."
            );
        }

        if (
            !message.member.permissions.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {
            return message.reply(
                "❌ Tu dois avoir la permission **Gérer le serveur**."
            );
        }

        const subcommand =
            args[0]?.toLowerCase();

        // ==========================================
        // AIDE
        // ==========================================

        if (!subcommand) {
            const embed =
                new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle("Action Log")
                    .setDescription(
                        "Salon de logs MiyuBot.\n" +
                        "Style **Dyno** pour les actions (messages, membres, salons).\n" +
                        "Style **Wick** pour la sécurité (raid, anti-nuke, lockdown)."
                    )
                    .addFields(
                        {
                            name: "📁 Créer le salon",
                            value:
                                "`/securitylogs create`",
                            inline: false
                        },
                        {
                            name: "🧪 Tester les logs",
                            value:
                                "`/securitylogs test`",
                            inline: false
                        },
                        {
                            name: "🔌 Désactiver",
                            value:
                                "`/securitylogs off`",
                            inline: false
                        },
                        {
                            name: "ℹ️ Informations",
                            value:
                                "`/securitylogs info`",
                            inline: false
                        }
                    )
                    .setFooter({
                        text:
                            "MiyuBot • Security System"
                    })
                    .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        // ==========================================
        // RÉCUPÉRER LA CONFIGURATION
        // ==========================================

        let settings =
            await get(
                `
                SELECT *
                FROM guild_settings
                WHERE guild_id = ?
                `,
                [
                    message.guild.id
                ]
            );

        if (!settings) {
            const now = Date.now();

            await run(
                `
                INSERT INTO guild_settings (
                    guild_id,
                    security_log_channel_id,
                    anti_raid_enabled,
                    anti_raid_threshold,
                    anti_raid_window,
                    auto_lockdown,
                    lockdown_active,
                    min_account_age_days,
                    anti_spam_enabled,
                    anti_bot_enabled,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    message.guild.id,
                    null,
                    1,
                    10,
                    15,
                    0,
                    0,
                    30,
                    1,
                    1,
                    now,
                    now
                ]
            );

            settings =
                await get(
                    `
                    SELECT *
                    FROM guild_settings
                    WHERE guild_id = ?
                    `,
                    [
                        message.guild.id
                    ]
                );
        }

        // ==========================================
        // CREATE
        // ==========================================

        if (subcommand === "create") {
            if (
                !message.guild.members.me.permissions.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {
                return message.reply(
                    "❌ MiyuBot n'a pas la permission **Gérer les salons**."
                );
            }

            if (settings.security_log_channel_id) {
                const existingChannel =
                    message.guild.channels.cache.get(
                        settings.security_log_channel_id
                    );

                if (existingChannel) {
                    await applyStarterPreset(message.guild.id);

                    return message.reply(
                        `${existingChannel} est déjà le salon de logs.\n` +
                        "Profil sécurité **communauté ~50 membres** appliqué :\n" +
                        "• kick auto des comptes de moins de **30 jours**\n" +
                        "• anti-raid, anti-spam, anti-nuke activés"
                    );
                }
            }

            const channelName =
                "🔐・miyubot-logs";

            const logOverwrites = [
                {
                    id: message.guild.roles.everyone.id,
                    deny: [
                        PermissionFlagsBits.ViewChannel
                    ]
                },
                {
                    id: message.client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages
                    ]
                }
            ];

            for (const role of message.guild.roles.cache.values()) {
                if (
                    role.id === message.guild.id ||
                    role.managed
                ) {
                    continue;
                }

                if (
                    role.permissions.has(
                        PermissionFlagsBits.Administrator
                    ) ||
                    role.permissions.has(
                        PermissionFlagsBits.ManageGuild
                    )
                ) {
                    logOverwrites.push({
                        id: role.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    });
                }
            }

            let channel =
                message.guild.channels.cache.find(
                    (currentChannel) =>
                        currentChannel.name ===
                        channelName
                );

            if (!channel) {
                channel =
                    await message.guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        topic:
                            "Journal de sécurité MiyuBot (messages, vocal, joins, invitations).",
                        reason:
                            "Création du salon centralisé des logs MiyuBot",
                        permissionOverwrites: logOverwrites
                    });
            }

            await run(
                `
                UPDATE guild_settings
                SET
                    security_log_channel_id = ?,
                    updated_at = ?
                WHERE guild_id = ?
                `,
                [
                    channel.id,
                    Date.now(),
                    message.guild.id
                ]
            );

            const preset = await applyStarterPreset(message.guild.id);

            const embed =
                new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle(
                        "🔐 Salon de logs configuré"
                    )
                    .setDescription(
                        `Le salon ${channel} est prêt.\n` +
                        "Profil **communauté ~50 membres** (évolutif) appliqué."
                    )
                    .addFields(
                        {
                            name: "📁 Salon",
                            value:
                                `${channel}\n\`${channel.name}\``,
                            inline: true
                        },
                        {
                            name: "🔒 Accès",
                            value:
                                "Admins / Gérer le serveur",
                            inline: true
                        },
                        {
                            name: "🆕 Comptes",
                            value:
                                `Kick auto si < **${preset.min_account_age_days} jours**`,
                            inline: true
                        },
                        {
                            name: "🛡️ Protection",
                            value:
                                "Anti-raid, anti-spam (timeout), anti-nuke",
                            inline: false
                        },
                        {
                            name: "📋 Logs",
                            value:
                                "Messages (modif/suppr), vocal, joins, invitations (menu inclus)",
                            inline: false
                        }
                    )
                    .setFooter({
                        text:
                            "MiyuBot • Security System"
                    })
                    .setTimestamp();

            await message.reply({
                embeds: [embed]
            });

            // ======================================
            // PREMIER LOG
            // ======================================

            const startupLog =
                new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle(
                        "🛡️ MiyuBot Security Logs"
                    )
                    .setDescription(
                        "Le système centralisé de logs de sécurité vient d'être configuré."
                    )
                    .addFields(
                        {
                            name: "👮 Configuré par",
                            value:
                                `${message.member}`,
                            inline: true
                        },
                        {
                            name: "🏠 Serveur",
                            value:
                                message.guild.name,
                            inline: true
                        },
                        {
                            name: "🆔 Serveur ID",
                            value:
                                message.guild.id,
                            inline: true
                        },
                        {
                            name: "📋 Événements surveillés",
                            value:
                                [
                                    "👤 Membres",
                                    "🚨 Anti-Raid",
                                    "🔒 Lockdown",
                                    "🛡️ Sécurité",
                                    "⚙️ Configuration",
                                    "🤖 Bots",
                                    "🎭 Rôles",
                                    "📁 Salons"
                                ].join("\n"),
                            inline: false
                        }
                    )
                    .setFooter({
                        text:
                            "MiyuBot Security • Journal central"
                    })
                    .setTimestamp();

            try {
                await channel.send({
                    embeds: [startupLog]
                });
            } catch (error) {
                console.error(
                    "❌ Impossible d'envoyer le premier log :",
                    error
                );
            }

            return;
        }

        // ==========================================
        // TEST
        // ==========================================

        if (subcommand === "test") {
            if (
                !settings.security_log_channel_id
            ) {
                return message.reply(
                    "❌ Aucun salon de logs n'est configuré.\n\nUtilise `/securitylogs create`."
                );
            }

            const channel =
                message.guild.channels.cache.get(
                    settings.security_log_channel_id
                );

            if (!channel) {
                return message.reply(
                    "❌ Le salon configuré n'existe plus.\n\nUtilise `/securitylogs create`."
                );
            }

            try {
                await sendSecurityLog(
                    message.guild,
                    {
                        title: "Message Deleted",
                        style: "dyno",
                        level: "danger",
                        actor: message.author,
                        target: message.author,
                        fields: [
                            {
                                name: "Channel",
                                value: `${channel}`,
                                inline: true
                            },
                            {
                                name: "Message",
                                value: "This is a Dyno-style action log test.",
                                inline: false
                            }
                        ]
                    }
                );

                await sendSecurityLog(
                    message.guild,
                    {
                        title: "Anti-Nuke Threshold Reached",
                        style: "wick",
                        level: "critical",
                        actor: message.author,
                        target: message.author,
                        description:
                            "Sample Wick-style intercept. No punishment was applied.",
                        fields: [
                            {
                                name: "Action",
                                value: "channel_delete `1/3`",
                                inline: true
                            },
                            {
                                name: "Punishment",
                                value: "none (test)",
                                inline: true
                            },
                            {
                                name: "Whitelisted",
                                value: "No",
                                inline: true
                            }
                        ]
                    }
                );
            } catch (error) {
                console.error(
                    "❌ Erreur test Security Logs :",
                    error
                );

                return message.reply(
                    "❌ MiyuBot n'arrive pas à écrire dans le salon de logs."
                );
            }

            return message.reply(
                `✅ Test envoyé dans ${channel}.`
            );
        }

        // ==========================================
        // INFO
        // ==========================================

        if (subcommand === "info") {
            let channel = null;

            if (
                settings.security_log_channel_id
            ) {
                channel =
                    message.guild.channels.cache.get(
                        settings.security_log_channel_id
                    );
            }

            const embed =
                new EmbedBuilder()
                    .setColor(
                        channel
                            ? 0x57F287
                            : 0xED4245
                    )
                    .setTitle(
                        "🔐 Configuration Security Logs"
                    )
                    .addFields(
                        {
                            name: "📁 Salon",
                            value:
                                channel
                                    ? `${channel}\n\`${channel.id}\``
                                    : "❌ Aucun",
                            inline: false
                        },
                        {
                            name: "📡 État",
                            value:
                                channel
                                    ? "🟢 Actif"
                                    : "🔴 Désactivé",
                            inline: true
                        },
                        {
                            name: "🔒 Accès",
                            value:
                                channel
                                    ? "Privé"
                                    : "N/A",
                            inline: true
                        }
                    )
                    .setFooter({
                        text:
                            "MiyuBot • Security System"
                    })
                    .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        // ==========================================
        // OFF
        // ==========================================

        if (subcommand === "off") {
            if (
                !settings.security_log_channel_id
            ) {
                return message.reply(
                    "⚠️ Aucun salon de logs n'est actuellement configuré."
                );
            }

            const oldChannel =
                message.guild.channels.cache.get(
                    settings.security_log_channel_id
                );

            await run(
                `
                UPDATE guild_settings
                SET
                    security_log_channel_id = NULL,
                    updated_at = ?
                WHERE guild_id = ?
                `,
                [
                    Date.now(),
                    message.guild.id
                ]
            );

            const embed =
                new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(
                        "🔕 Security Logs désactivés"
                    )
                    .setDescription(
                        "MiyuBot n'enverra plus automatiquement les logs de sécurité dans un salon."
                    )
                    .addFields({
                        name: "📁 Ancien salon",
                        value:
                            oldChannel
                                ? `${oldChannel}`
                                : "Salon introuvable"
                    })
                    .setFooter({
                        text:
                            "MiyuBot • Security System"
                    })
                    .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        // ==========================================
        // COMMANDE INCONNUE
        // ==========================================

        return message.reply(
            "❌ Sous-commande inconnue.\n\n" +
            "Utilise `/securitylogs` pour voir les commandes disponibles."
        );
    }
};