const {
    PermissionFlagsBits
} = require("discord.js");

const {
    createModerationCase
} = require("../database/database");

const {
    sendSecurityLog
} = require("../security/securityLogger");

const USER_ID_REGEX = /^(?:<@!?(\d{17,22})>|(\d{17,22}))$/;

function parseUserId(input) {
    if (!input) {
        return null;
    }

    const match = String(input).trim().match(USER_ID_REGEX);

    return match ? (match[1] || match[2]) : null;
}

function parseDurationMs(input, fallbackMs = 10 * 60 * 1000) {
    if (!input) {
        return fallbackMs;
    }

    const raw = String(input).trim().toLowerCase();
    const match = raw.match(/^(\d+)\s*(s|sec|secs|m|min|h|d|j)?$/);

    if (!match) {
        return null;
    }

    const amount = Number(match[1]);
    const unit = match[2] || "m";

    const multipliers = {
        s: 1000,
        sec: 1000,
        secs: 1000,
        m: 60 * 1000,
        min: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        j: 24 * 60 * 60 * 1000
    };

    return amount * (multipliers[unit] || multipliers.m);
}

function formatDuration(ms) {
    const totalSeconds = Math.max(1, Math.round(ms / 1000));

    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }

    if (totalSeconds < 3600) {
        return `${Math.round(totalSeconds / 60)}m`;
    }

    if (totalSeconds < 86400) {
        return `${Math.round(totalSeconds / 3600)}h`;
    }

    return `${Math.round(totalSeconds / 86400)}d`;
}

function extractReason(args) {
    const reason = args.join(" ").trim();

    return reason || "Aucune raison fournie";
}

function canActOn(moderator, targetMember) {
    if (!moderator || !targetMember) {
        return {
            ok: false,
            error: "Membre introuvable."
        };
    }

    if (targetMember.id === moderator.id) {
        return {
            ok: false,
            error: "Tu ne peux pas t'auto-sanctionner."
        };
    }

    if (targetMember.id === moderator.guild.ownerId) {
        return {
            ok: false,
            error: "Impossible d'agir sur le propriétaire du serveur."
        };
    }

    if (targetMember.user?.bot && targetMember.id === moderator.client.user.id) {
        return {
            ok: false,
            error: "Impossible d'agir sur MiyuBot."
        };
    }

    if (
        moderator.id !== moderator.guild.ownerId &&
        moderator.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0
    ) {
        return {
            ok: false,
            error: "Ce membre a un rôle égal ou supérieur au tien."
        };
    }

    return { ok: true };
}

function botCanAct(targetMember, action) {
    if (!targetMember) {
        return {
            ok: false,
            error: "Membre introuvable."
        };
    }

    if (action === "ban") {
        if (!targetMember.bannable) {
            return {
                ok: false,
                error: "MiyuBot n'a pas le droit de bannir ce membre (rôle trop haut)."
            };
        }
    } else if (action === "kick") {
        if (!targetMember.kickable) {
            return {
                ok: false,
                error: "MiyuBot n'a pas le droit d'expulser ce membre."
            };
        }
    } else if (!targetMember.moderatable) {
        return {
            ok: false,
            error: "MiyuBot n'a pas le droit de modérer ce membre."
        };
    }

    return { ok: true };
}

async function resolveMember(message, raw) {
    const userId =
        parseUserId(raw) ||
        message.mentions.users.first()?.id ||
        null;

    if (!userId) {
        return {
            member: null,
            user: null,
            userId: null
        };
    }

    const member = await message.guild.members.fetch(userId).catch(() => null);
    const user =
        member?.user ||
        (await message.client.users.fetch(userId).catch(() => null));

    return {
        member,
        user,
        userId
    };
}

async function recordAndLog(guild, {
    target,
    actor,
    title,
    level = "danger",
    caseType,
    action,
    reason,
    fields = []
}) {
    const caseId = await createModerationCase(
        guild.id,
        target.id,
        actor.id,
        caseType,
        action,
        reason,
        {}
    );

    await sendSecurityLog(guild, {
        title,
        level,
        actor,
        target,
        fields: [
            {
                name: "Reason",
                value: reason,
                inline: false
            },
            {
                name: "Case",
                value: caseId ? `#${caseId}` : "—",
                inline: true
            },
            ...fields
        ]
    });

    return caseId;
}

module.exports = {
    PermissionFlagsBits,
    parseUserId,
    parseDurationMs,
    formatDuration,
    extractReason,
    canActOn,
    botCanAct,
    resolveMember,
    recordAndLog
};
