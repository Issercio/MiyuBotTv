const {
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");

const { run, get, databaseReady } = require("../database/database");

const CLIPS_CHANNEL_NAME = "clips";

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

async function saveClipsChannelId(guildId, channelId) {
    await ensureGuildSettings(guildId);
    await run(
        `
        UPDATE guild_settings
        SET
            clips_channel_id = ?,
            updated_at = ?
        WHERE guild_id = ?
        `,
        [channelId, Date.now(), guildId]
    );
}

function isUsableTextChannel(channel) {
    return Boolean(
        channel &&
        (
            channel.type === ChannelType.GuildText ||
            channel.type === ChannelType.GuildAnnouncement
        )
    );
}

async function ensureClipsChannel(guild, preferredChannel) {
    if (preferredChannel && isUsableTextChannel(preferredChannel)) {
        await saveClipsChannelId(guild.id, preferredChannel.id);
        return preferredChannel;
    }

    const settings = await ensureGuildSettings(guild.id);

    if (settings.clips_channel_id) {
        const existing = guild.channels.cache.get(settings.clips_channel_id);

        if (isUsableTextChannel(existing)) {
            return existing;
        }
    }

    const byName = guild.channels.cache.find(
        (channel) =>
            isUsableTextChannel(channel) &&
            channel.name === CLIPS_CHANNEL_NAME
    );

    if (byName) {
        await saveClipsChannelId(guild.id, byName.id);
        return byName;
    }

    const created = await guild.channels.create({
        name: CLIPS_CHANNEL_NAME,
        type: ChannelType.GuildText,
        topic: "Clips du live Twitch. Salon lecture seule.",
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
        reason: "MiyuBot salon clips Twitch"
    });

    await saveClipsChannelId(guild.id, created.id);
    return created;
}

async function findClipsChannel(discord, preferredId) {
    if (!discord || typeof discord.channels?.fetch !== "function") {
        return null;
    }

    if (preferredId) {
        const fromEnv = await discord.channels.fetch(preferredId).catch(() => null);

        if (isUsableTextChannel(fromEnv)) {
            return fromEnv;
        }
    }

    for (const guild of discord.guilds.cache.values()) {
        const settings = await ensureGuildSettings(guild.id);

        if (!settings.clips_channel_id) {
            continue;
        }

        const channel =
            guild.channels.cache.get(settings.clips_channel_id) ||
            await guild.channels.fetch(settings.clips_channel_id).catch(() => null);

        if (isUsableTextChannel(channel)) {
            return channel;
        }
    }

    return null;
}

function discordClipUrl(clip) {
    const raw = String(clip.id || clip.url || "");
    const id = raw
        .replace(
            /^https?:\/\/(?:www\.)?(?:clips\.twitch\.tv|twitch\.tv\/[^/]+\/clip)\//i,
            ""
        )
        .split("?")[0]
        .split("/")
        .filter(Boolean)
        .pop();

    const login = String(
        clip.channel ||
        clip.broadcaster_login ||
        clip.broadcaster_name ||
        ""
    )
        .replace(/^#/, "")
        .toLowerCase();

    if (!id) {
        return "";
    }

    if (!login) {
        return `https://www.twitch.tv/${id}`;
    }

    return `https://www.twitch.tv/${login}/clip/${id}`;
}

async function postClip(discord, clip, preferredId) {
    const channel = await findClipsChannel(discord, preferredId);
    const url = discordClipUrl(clip);

    if (!channel || !url) {
        return false;
    }

    await channel.send(url);

    return true;
}

async function setupClipsChannel(guild, preferredChannel) {
    const channel = await ensureClipsChannel(guild, preferredChannel);

    return {
        content:
            `🎬 Salon clips : ${channel}\n` +
            "Les clips Twitch (dont `!clip`) seront postés **ici uniquement**.\n" +
            "Les membres peuvent lire, pas écrire."
    };
}

module.exports = {
    findClipsChannel,
    postClip,
    setupClipsChannel
};
