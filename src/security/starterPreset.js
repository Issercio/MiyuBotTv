const {
    databaseReady,
    run
} = require("../database/database");

const STARTER_PRESET = {
    anti_raid_enabled: 1,
    anti_raid_threshold: 8,
    anti_raid_window: 15,
    auto_lockdown: 0,
    min_account_age_days: 30,
    anti_spam_enabled: 1,
    anti_spam_threshold: 6,
    anti_spam_window: 8,
    anti_spam_sanction: "timeout",
    anti_bot_enabled: 1,
    anti_nuke_enabled: 1,
    anti_nuke_threshold: 3,
    anti_nuke_threshold_channel: 3,
    anti_nuke_threshold_role: 3,
    anti_nuke_threshold_webhook: 2,
    anti_nuke_threshold_ban: 3,
    anti_nuke_window: 15,
    anti_nuke_sanction: "ban"
};

async function applyStarterPreset(guildId) {
    await databaseReady;

    await run(
        `
        UPDATE guild_settings
        SET
            anti_raid_enabled = ?,
            anti_raid_threshold = ?,
            anti_raid_window = ?,
            auto_lockdown = ?,
            min_account_age_days = ?,
            anti_spam_enabled = ?,
            anti_spam_threshold = ?,
            anti_spam_window = ?,
            anti_spam_sanction = ?,
            anti_bot_enabled = ?,
            anti_nuke_enabled = ?,
            anti_nuke_threshold = ?,
            anti_nuke_threshold_channel = ?,
            anti_nuke_threshold_role = ?,
            anti_nuke_threshold_webhook = ?,
            anti_nuke_threshold_ban = ?,
            anti_nuke_window = ?,
            anti_nuke_sanction = ?,
            updated_at = ?
        WHERE guild_id = ?
        `,
        [
            STARTER_PRESET.anti_raid_enabled,
            STARTER_PRESET.anti_raid_threshold,
            STARTER_PRESET.anti_raid_window,
            STARTER_PRESET.auto_lockdown,
            STARTER_PRESET.min_account_age_days,
            STARTER_PRESET.anti_spam_enabled,
            STARTER_PRESET.anti_spam_threshold,
            STARTER_PRESET.anti_spam_window,
            STARTER_PRESET.anti_spam_sanction,
            STARTER_PRESET.anti_bot_enabled,
            STARTER_PRESET.anti_nuke_enabled,
            STARTER_PRESET.anti_nuke_threshold,
            STARTER_PRESET.anti_nuke_threshold_channel,
            STARTER_PRESET.anti_nuke_threshold_role,
            STARTER_PRESET.anti_nuke_threshold_webhook,
            STARTER_PRESET.anti_nuke_threshold_ban,
            STARTER_PRESET.anti_nuke_window,
            STARTER_PRESET.anti_nuke_sanction,
            Date.now(),
            guildId
        ]
    );

    return STARTER_PRESET;
}

module.exports = {
    STARTER_PRESET,
    applyStarterPreset
};
