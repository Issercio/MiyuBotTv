const {
    ChannelType,
    PermissionsBitField
} = require("discord.js");

const snapshots = new Map();
const MAX_PER_GUILD = 40;
const MAX_AGE_MS = 10 * 60 * 1000;

function guildBucket(guildId) {
    const list = snapshots.get(guildId) || [];
    snapshots.set(guildId, list);
    return list;
}

function prune(guildId) {
    const now = Date.now();
    const list = (snapshots.get(guildId) || []).filter(
        (item) => now - item.at <= MAX_AGE_MS
    );
    snapshots.set(guildId, list.slice(-MAX_PER_GUILD));
    return snapshots.get(guildId);
}

function remember(guildId, kind, data) {
    const list = guildBucket(guildId);
    list.push({
        at: Date.now(),
        kind,
        data
    });
    prune(guildId);
}

function snapshotChannel(channel) {
    if (!channel?.guild) {
        return;
    }

    if (typeof channel.isThread === "function" && channel.isThread()) {
        return;
    }

    if (channel.type === ChannelType.DM || channel.type === ChannelType.GroupDM) {
        return;
    }

    remember(channel.guild.id, "channel", {
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId || null,
        topic: "topic" in channel ? channel.topic : null,
        nsfw: Boolean(channel.nsfw),
        rateLimitPerUser: channel.rateLimitPerUser || 0,
        bitrate: channel.bitrate || null,
        userLimit: channel.userLimit || 0,
        overwrites: [...(channel.permissionOverwrites?.cache?.values() || [])].map((overwrite) => ({
            id: overwrite.id,
            type: overwrite.type,
            allow: overwrite.allow.bitfield.toString(),
            deny: overwrite.deny.bitfield.toString()
        }))
    });
}

function snapshotRole(role) {
    if (!role?.guild || role.managed || role.id === role.guild.id) {
        return;
    }

    remember(role.guild.id, "role", {
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions.bitfield.toString(),
        unicodeEmoji: role.unicodeEmoji || null
    });
}

async function restoreChannel(guild, data) {
    const parent =
        data.parentId && guild.channels.cache.get(data.parentId)
            ? data.parentId
            : undefined;

    const payload = {
        name: data.name || "restored-channel",
        type: data.type,
        parent,
        reason: "MiyuBot anti-nuke recovery"
    };

    if (data.topic) {
        payload.topic = data.topic;
    }

    if (typeof data.nsfw === "boolean") {
        payload.nsfw = data.nsfw;
    }

    if (data.rateLimitPerUser) {
        payload.rateLimitPerUser = data.rateLimitPerUser;
    }

    if (data.bitrate) {
        payload.bitrate = data.bitrate;
    }

    if (data.userLimit) {
        payload.userLimit = data.userLimit;
    }

    if (Array.isArray(data.overwrites) && data.overwrites.length) {
        payload.permissionOverwrites = data.overwrites.map((overwrite) => ({
            id: overwrite.id,
            type: overwrite.type,
            allow: new PermissionsBitField(BigInt(overwrite.allow || "0")),
            deny: new PermissionsBitField(BigInt(overwrite.deny || "0"))
        }));
    }

    return guild.channels.create(payload);
}

async function restoreRole(guild, data) {
    return guild.roles.create({
        name: data.name || "restored-role",
        color: data.color || 0,
        hoist: Boolean(data.hoist),
        mentionable: Boolean(data.mentionable),
        permissions: new PermissionsBitField(BigInt(data.permissions || "0")),
        unicodeEmoji: data.unicodeEmoji || undefined,
        reason: "MiyuBot anti-nuke recovery"
    });
}

async function restoreRecentDeletions(guild, actionType, windowMs) {
    if (!guild) {
        return [];
    }

    const kind =
        actionType === "channel_delete"
            ? "channel"
            : actionType === "role_delete"
                ? "role"
                : null;

    if (!kind) {
        return [];
    }

    const cutoff = Date.now() - Math.max(5000, windowMs || 15000);
    const list = prune(guild.id);
    const selected = list
        .filter((item) => item.kind === kind && item.at >= cutoff)
        .slice(-15);

    const restored = [];

    for (const item of selected) {
        try {
            if (kind === "channel") {
                const channel = await restoreChannel(guild, item.data);
                restored.push(`#${channel.name}`);
            } else {
                const role = await restoreRole(guild, item.data);
                restored.push(`@${role.name}`);
            }
        } catch (error) {
            restored.push(
                `échec ${item.data?.name || kind}: ${error.message || "erreur"}`
            );
        }
    }

    snapshots.set(
        guild.id,
        list.filter((item) => !selected.includes(item))
    );

    return restored;
}

module.exports = {
    snapshotChannel,
    snapshotRole,
    restoreRecentDeletions
};
