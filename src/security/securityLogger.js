const {
    EmbedBuilder
} = require("discord.js");

const {
    get,
    databaseReady
} = require("../database/database");

const SECURITY_LOG_CACHE_TTL_MS = 60 * 1000;
const securityLogChannelCache = new Map();
const guildLogPipelines = new Map();


/*
 * ============================================================
 * MIYUBOT - SECURITY LOGGER
 * ============================================================
 *
 * Gestionnaire centralisé des logs de sécurité.
 *
 * Tous les événements importants de MiyuBot pourront passer
 * par ce fichier afin de conserver un format uniforme.
 *
 * ============================================================
 */


/*
 * ============================================================
 * COULEURS
 * ============================================================
 */

const COLORS = {
    info: 0x337FD5,
    success: 0x43B581,
    warning: 0xFAA61A,
    danger: 0xF04747,
    critical: 0xCC0605,
    security: 0xE74C3C,
    neutral: 0x99AAB5
};

const WICK_COLOR = 0xFF1A1A;


/*
 * ============================================================
 * OBTENIR LE SALON DE LOGS
 * ============================================================
 */

async function getSecurityLogChannel(guild) {
    if (!guild) {
        return null;
    }

    try {
        await databaseReady;

        const cachedData =
            securityLogChannelCache.get(guild.id);

        if (
            cachedData &&
            Date.now() - cachedData.cachedAt <= SECURITY_LOG_CACHE_TTL_MS
        ) {
            const cachedChannel =
                guild.channels.cache.get(
                    cachedData.channelId
                );

            if (cachedChannel && cachedChannel.isTextBased()) {
                return cachedChannel;
            }
        }

        const settings = await get(
            `
            SELECT security_log_channel_id
            FROM guild_settings
            WHERE guild_id = ?
            `,
            [guild.id]
        );

        if (!settings) {
            return null;
        }

        const channelId =
            settings.security_log_channel_id;

        if (!channelId) {
            return null;
        }

        let channel =
            guild.channels.cache.get(channelId);

        if (!channel) {
            try {
                channel =
                    await guild.channels.fetch(channelId);
            } catch (error) {
                console.error(
                    "⚠️ Impossible de récupérer le salon de logs :",
                    error
                );

                return null;
            }
        }

        if (!channel) {
            return null;
        }

        if (!channel.isTextBased()) {
            return null;
        }

        securityLogChannelCache.set(
            guild.id,
            {
                channelId,
                cachedAt: Date.now()
            }
        );

        return channel;
    } catch (error) {
        console.error(
            "❌ Erreur récupération salon sécurité :",
            error
        );

        return null;
    }
}


function enqueueGuildLog(guildId, task) {
    const previousTask =
        guildLogPipelines.get(guildId) || Promise.resolve();

    const nextTask =
        previousTask
            .catch(() => null)
            .then(task)
            .finally(() => {
                if (guildLogPipelines.get(guildId) === nextTask) {
                    guildLogPipelines.delete(guildId);
                }
            });

    guildLogPipelines.set(guildId, nextTask);

    return nextTask;
}


/*
 * ============================================================
 * NETTOYER UNE VALEUR
 * ============================================================
 */

function cleanValue(value, fallback = "Inconnu") {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return fallback;
    }

    const text = String(value);

    if (text.length > 1024) {
        return text.slice(0, 1021) + "...";
    }

    return text;
}


/*
 * ============================================================
 * FORMATER UN UTILISATEUR
 * ============================================================
 */

function formatUser(user) {
    if (!user) {
        return "Inconnu";
    }

    if (user.id) {
        const username =
            user.username ||
            user.user?.username ||
            "Utilisateur";

        return `<@${user.id}> (\`${username}\`)`;
    }

    if (user.user && user.user.id) {
        const username =
            user.user.username ||
            "Utilisateur";

        return `<@${user.user.id}> (\`${username}\`)`;
    }

    return cleanValue(user.username);
}


/*
 * ============================================================
 * FORMATER UNE CIBLE
 * ============================================================
 */

function formatTarget(target) {
    if (!target) {
        return "None";
    }

    if (target.id) {
        const username =
            target.username ||
            target.user?.username ||
            target.name ||
            "Unknown";

        return `<@${target.id}> (\`${username}\`)`;
    }

    return cleanValue(
        target.name ||
        target.username ||
        target.id
    );
}


function getEntityId(entity) {
    if (!entity) {
        return null;
    }

    return entity.id || entity.user?.id || null;
}


function getEntityAvatar(entity) {
    if (!entity) {
        return null;
    }

    if (typeof entity.displayAvatarURL === "function") {
        return entity.displayAvatarURL({
            size: 128
        });
    }

    if (entity.user && typeof entity.user.displayAvatarURL === "function") {
        return entity.user.displayAvatarURL({
            size: 128
        });
    }

    return null;
}


function dynoUserLine(entity) {
    if (!entity) {
        return "Unknown";
    }

    const id = getEntityId(entity);
    const username =
        entity.username ||
        entity.user?.username ||
        entity.globalName ||
        entity.user?.globalName ||
        entity.tag ||
        "Unknown";

    if (!id) {
        return cleanValue(username);
    }

    return `${username} (${id})\n<@${id}>`;
}


function stripDecorations(text) {
    return String(text || "")
        .replace(/^[^\p{L}\p{N}]+/u, "")
        .trim();
}


function dynoFieldName(name) {
    const stripped = stripDecorations(name).toLowerCase();

    if (stripped === "content" || stripped === "message") {
        return "Message";
    }

    if (stripped === "target") {
        return "User";
    }

    if (stripped === "moderator" || stripped === "actor") {
        return "Moderator";
    }

    if (stripped.includes("channel")) {
        return "Channel";
    }

    if (stripped.includes("reason")) {
        return "Reason";
    }

    const labeled = stripDecorations(name);

    return labeled || "Info";
}


function resolveLogStyle(options = {}) {
    if (options.style === "wick" || options.style === "dyno") {
        return options.style;
    }

    const title = String(options.title || "").toLowerCase();
    const wickHints = [
        "raid",
        "nuke",
        "lockdown",
        "quarantine",
        "antinuke",
        "intercept",
        "échec",
        "echec"
    ];

    if (options.level === "critical") {
        return "wick";
    }

    if (wickHints.some((hint) => title.includes(hint))) {
        return "wick";
    }

    return "dyno";
}


/*
 * ============================================================
 * DÉTERMINER LA COULEUR
 * ============================================================
 */

function getColor(level = "info") {
    return COLORS[level] || COLORS.info;
}


/*
 * ============================================================
 * ENVOYER UN LOG
 * ============================================================
 */

async function sendSecurityLog(
    guild,
    options = {}
) {
    if (!guild) {
        return {
            success: false,
            reason: "guild_missing"
        };
    }

    try {
        const channel =
            await getSecurityLogChannel(guild);

        if (!channel) {
            return {
                success: false,
                reason: "channel_not_configured"
            };
        }

        const {
            title = "Server Log",
            description = null,
            level = "info",
            color = null,
            actor = null,
            target = null,
            fields = [],
            footer = null,
            timestamp = true,
            mention = false
        } = options;

        const style = resolveLogStyle(options);
        const eventTitle = stripDecorations(title) || "Server Log";
        const extraFields = Array.isArray(fields)
            ? fields.filter(
                (field) => {
                    if (!field || !field.name) {
                        return false;
                    }

                    if (
                        field.value === undefined ||
                        field.value === null
                    ) {
                        return false;
                    }

                    const text = String(field.value).trim();

                    return (
                        text.length > 0 &&
                        text.toLowerCase() !== "aucun" &&
                        text.toLowerCase() !== "aucune" &&
                        text.toLowerCase() !== "inconnu"
                    );
                }
            )
            : [];

        const embed = new EmbedBuilder();

        if (style === "wick") {
            embed
                .setColor(color !== null ? color : WICK_COLOR)
                .setTitle("⚠  SECURITY INTERCEPT")
                .setDescription(
                    `**${eventTitle}**` +
                    (description ? `\n${cleanValue(description)}` : "")
                );

            if (target) {
                embed.addFields({
                    name: "Offender",
                    value: dynoUserLine(target),
                    inline: true
                });
            }

            if (actor) {
                embed.addFields({
                    name: "Executor",
                    value: dynoUserLine(actor),
                    inline: true
                });
            }

            if (extraFields.length > 0) {
                embed.addFields(
                    extraFields.slice(0, 20).map((field) => ({
                        name: dynoFieldName(field.name),
                        value: cleanValue(field.value),
                        inline: field.inline !== false
                    }))
                );
            }

            embed.setFooter({
                text: footer || `MiyuBot Security • ${guild.name}`
            });
        } else {
            embed.setColor(
                color !== null
                    ? color
                    : getColor(level)
            );

            embed.setAuthor({
                name: eventTitle,
                iconURL:
                    getEntityAvatar(target) ||
                    getEntityAvatar(actor) ||
                    guild.iconURL({
                        size: 64
                    }) ||
                    undefined
            });

            if (description) {
                embed.setDescription(
                    cleanValue(description)
                );
            }

            const thumbnail =
                getEntityAvatar(target) ||
                getEntityAvatar(actor);

            if (thumbnail) {
                embed.setThumbnail(thumbnail);
            }

            if (target) {
                embed.addFields({
                    name: "User",
                    value: dynoUserLine(target),
                    inline: true
                });
            }

            if (actor) {
                embed.addFields({
                    name: "Moderator",
                    value: dynoUserLine(actor),
                    inline: true
                });
            }

            if (extraFields.length > 0) {
                embed.addFields(
                    extraFields.slice(0, 22).map((field) => ({
                        name: dynoFieldName(field.name),
                        value: cleanValue(field.value),
                        inline: field.inline !== false
                    }))
                );
            }

            const footerId =
                getEntityId(target) ||
                getEntityId(actor) ||
                guild.id;

            embed.setFooter({
                text: footer || `ID: ${footerId}`
            });
        }

        if (timestamp) {
            embed.setTimestamp();
        }

        const payload = {
            embeds: [embed]
        };

        if (mention && style === "wick") {
            payload.content = "@here";
            payload.allowedMentions = {
                parse: ["here"]
            };
        }

        await enqueueGuildLog(
            guild.id,
            async () => {
                await channel.send(payload);
            }
        );

        return {
            success: true,
            channel
        };
    } catch (error) {
        console.error(
            "❌ Erreur envoi log sécurité :",
            error
        );

        return {
            success: false,
            reason: "send_error",
            error
        };
    }
}


/*
 * ============================================================
 * LOG MEMBRE
 * ============================================================
 */

async function logMemberEvent(
    guild,
    type,
    member,
    options = {}
) {
    const types = {
        join: {
            title: member?.user?.bot
                ? "Bot Joined"
                : "Member Joined",
            level: member?.user?.bot
                ? "warning"
                : "success"
        },

        leave: {
            title: "Member Left",
            level: "info"
        },

        kick: {
            title: "Member Kicked",
            level: "danger"
        },

        ban: {
            title: "Member Banned",
            level: "danger"
        },

        unban: {
            title: "Member Unbanned",
            level: "warning"
        },

        timeout: {
            title: "Member Timed Out",
            level: "warning"
        },

        timeout_remove: {
            title: "Timeout Removed",
            level: "success"
        },

        nickname: {
            title: "Nickname Updated",
            level: "info"
        },

        role_add: {
            title: "Role Added",
            level: "info"
        },

        role_remove: {
            title: "Role Removed",
            level: "warning"
        }
    };

    const config =
        types[type] || {
            title: "👤 Événement membre",
            level: "info"
        };

    return sendSecurityLog(
        guild,
        {
            ...options,
            title:
                options.title ||
                config.title,
            level:
                options.level ||
                config.level,
            target:
                options.target ||
                member
        }
    );
}


/*
 * ============================================================
 * LOG SALON
 * ============================================================
 */

async function logChannelEvent(
    guild,
    type,
    channel,
    options = {}
) {
    const types = {
        create: {
            title: "Channel Created",
            level: "info"
        },

        delete: {
            title: "Channel Deleted",
            level: "danger"
        },

        update: {
            title: "Channel Updated",
            level: "warning"
        }
    };

    const config =
        types[type] || {
            title: "📁 Événement salon",
            level: "info"
        };

    return sendSecurityLog(
        guild,
        {
            ...options,
            title:
                options.title ||
                config.title,
            level:
                options.level ||
                config.level,
            fields: [
                {
                    name: "Channel",
                    value:
                        channel?.id
                            ? `<#${channel.id}>`
                            : cleanValue(
                                channel?.name
                            ),
                    inline: true
                },
                ...(options.fields || [])
            ]
        }
    );
}


/*
 * ============================================================
 * LOG RÔLE
 * ============================================================
 */

async function logRoleEvent(
    guild,
    type,
    role,
    options = {}
) {
    const types = {
        create: {
            title: "Role Created",
            level: "info"
        },

        delete: {
            title: "Role Deleted",
            level: "danger"
        },

        update: {
            title: "Role Updated",
            level: "warning"
        },

        add: {
            title: "Role Assigned",
            level: "info"
        },

        remove: {
            title: "Role Removed",
            level: "warning"
        }
    };

    const config =
        types[type] || {
            title: "🎭 Événement rôle",
            level: "info"
        };

    return sendSecurityLog(
        guild,
        {
            ...options,
            title:
                options.title ||
                config.title,
            level:
                options.level ||
                config.level,
            fields: [
                {
                    name: "Role",
                    value:
                        role?.id
                            ? `<@&${role.id}>`
                            : cleanValue(
                                role?.name
                            ),
                    inline: true
                },
                ...(options.fields || [])
            ]
        }
    );
}


/*
 * ============================================================
 * LOG RAID
 * ============================================================
 */

async function logRaid(
    guild,
    options = {}
) {
    return sendSecurityLog(
        guild,
        {
            ...options,
            title:
                options.title ||
                "Mass Join / Raid",
            level:
                options.level ||
                "critical",
            style: "wick",
            mention: options.mention !== false
        }
    );
}


/*
 * ============================================================
 * LOG LOCKDOWN
 * ============================================================
 */

async function logLockdown(
    guild,
    activated,
    options = {}
) {
    return sendSecurityLog(
        guild,
        {
            ...options,
            title:
                options.title ||
                (
                    activated
                        ? "Server Lockdown Enabled"
                        : "Server Lockdown Disabled"
                ),
            level:
                options.level ||
                (
                    activated
                        ? "critical"
                        : "success"
                ),
            style: "wick"
        }
    );
}


/*
 * ============================================================
 * LOG CONFIGURATION
 * ============================================================
 */

async function logConfiguration(
    guild,
    options = {}
) {
    return sendSecurityLog(
        guild,
        {
            ...options,
            title:
                options.title ||
                "⚙️ Configuration Updated",
            level:
                options.level ||
                "info"
        }
    );
}


/*
 * ============================================================
 * LOG SÉCURITÉ GÉNÉRIQUE
 * ============================================================
 */

async function logSecurity(
    guild,
    title,
    description,
    options = {}
) {
    return sendSecurityLog(
        guild,
        {
            ...options,
            title,
            description
        }
    );
}


/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    COLORS,

    getSecurityLogChannel,

    sendSecurityLog,

    logSecurity,

    logMemberEvent,

    logChannelEvent,

    logRoleEvent,

    logRaid,

    logLockdown,

    logConfiguration
};