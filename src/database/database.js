const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

function resolveDatabasePath() {
    if (process.env.DATABASE_PATH) {
        return process.env.DATABASE_PATH;
    }

    if (
        fs.existsSync("/data") &&
        fs.statSync("/data").isDirectory()
    ) {
        return path.join("/data", "miyubot.db");
    }

    return path.join(__dirname, "miyubot.db");
}

const dbPath = resolveDatabasePath();

const db = new sqlite3.Database(
    dbPath,
    (error) => {
        if (error) {
            console.error(
                "❌ Erreur lors de la connexion à SQLite :",
                error.message
            );
        } else {
            console.log(
                "🗄️ Base de données MiyuBot connectée !"
            );
        }
    }
);


// ==========================================
// VÉRIFIER UNE COLONNE
// ==========================================

function columnExists(
    table,
    column
) {

    return new Promise(
        (resolve, reject) => {

            db.all(
                `PRAGMA table_info(${table})`,
                [],
                (
                    error,
                    columns
                ) => {

                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(
                        columns.some(
                            (item) =>
                                item.name === column
                        )
                    );
                }
            );
        }
    );
}


// ==========================================
// AJOUTER UNE COLONNE SI ABSENTE
// ==========================================

async function addColumnIfMissing(
    table,
    column,
    definition
) {

    try {

        const exists =
            await columnExists(
                table,
                column
            );


        if (!exists) {

            await run(
                `
                ALTER TABLE ${table}
                ADD COLUMN ${column} ${definition}
                `
            );


            console.log(
                `🔧 Migration : colonne ajoutée ${table}.${column}`
            );
        }

    } catch (error) {

        console.error(
            `❌ Erreur migration ${table}.${column}:`,
            error.message
        );
    }
}


// ==========================================
// RUN
// ==========================================

function run(
    query,
    params = []
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            db.run(
                query,
                params,
                function (error) {

                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve({
                        lastID:
                            this.lastID,

                        changes:
                            this.changes
                    });
                }
            );
        }
    );
}


// ==========================================
// GET
// ==========================================

function get(
    query,
    params = []
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            db.get(
                query,
                params,
                (
                    error,
                    row
                ) => {

                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(row);
                }
            );
        }
    );
}


// ==========================================
// ALL
// ==========================================

function all(
    query,
    params = []
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            db.all(
                query,
                params,
                (
                    error,
                    rows
                ) => {

                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(rows);
                }
            );
        }
    );
}


// ==========================================
// INITIALISATION
// ==========================================

async function initializeDatabase() {

    try {

        await run(
            `
            PRAGMA foreign_keys = ON
            `
        );

        await run(
            `
            PRAGMA journal_mode = WAL
            `
        );

        await run(
            `
            PRAGMA synchronous = NORMAL
            `
        );

        await run(
            `
            PRAGMA temp_store = MEMORY
            `
        );

        await run(
            `
            PRAGMA busy_timeout = 5000
            `
        );


        // ======================================
        // PROFILS UTILISATEURS
        // ======================================

        await run(
            `
            CREATE TABLE IF NOT EXISTS user_profiles (

                user_id TEXT PRIMARY KEY,

                username TEXT,

                global_name TEXT,

                avatar_url TEXT,

                is_bot INTEGER DEFAULT 0,

                account_created_at INTEGER,

                first_seen_at INTEGER NOT NULL,

                last_seen_at INTEGER NOT NULL

            )
            `
        );


        // ======================================
        // MEMBRES SERVEUR
        // ======================================

        await run(
            `
            CREATE TABLE IF NOT EXISTS guild_members (

                guild_id TEXT NOT NULL,

                user_id TEXT NOT NULL,

                current_nickname TEXT,

                joined_at INTEGER,

                first_seen_at INTEGER NOT NULL,

                last_seen_at INTEGER NOT NULL,

                PRIMARY KEY (
                    guild_id,
                    user_id
                )

            )
            `
        );


        // ======================================
        // HISTORIQUE DES NOMS
        // ======================================

        await run(
            `
            CREATE TABLE IF NOT EXISTS name_history (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                guild_id TEXT,

                user_id TEXT NOT NULL,

                name_type TEXT NOT NULL,

                old_value TEXT,

                new_value TEXT NOT NULL,

                changed_at INTEGER NOT NULL

            )
            `
        );


        // ======================================
        // HISTORIQUE MEMBRE
        // ======================================

        await run(
            `
            CREATE TABLE IF NOT EXISTS member_history (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                guild_id TEXT NOT NULL,

                user_id TEXT NOT NULL,

                event_type TEXT NOT NULL,

                old_value TEXT,

                new_value TEXT,

                event_date INTEGER NOT NULL

            )
            `
        );


        // ======================================
        // HISTORIQUE RÔLES
        // ======================================

        await run(
            `
            CREATE TABLE IF NOT EXISTS role_history (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                guild_id TEXT NOT NULL,

                user_id TEXT NOT NULL,

                role_id TEXT NOT NULL,

                role_name TEXT,

                action TEXT NOT NULL,

                changed_at INTEGER NOT NULL

            )
            `
        );


        // ======================================
        // WARNINGS
        // ======================================

        await run(
            `
            CREATE TABLE IF NOT EXISTS warnings (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                guild_id TEXT NOT NULL,

                user_id TEXT NOT NULL,

                moderator_id TEXT NOT NULL,

                reason TEXT,

                created_at INTEGER NOT NULL,

                active INTEGER DEFAULT 1

            )
            `
        );


        // ======================================
        // CONFIGURATION SERVEUR
        // ======================================

        await run(
            `
            CREATE TABLE IF NOT EXISTS guild_settings (

                guild_id TEXT PRIMARY KEY,

                security_log_channel_id TEXT,

                anti_raid_enabled INTEGER DEFAULT 1,

                anti_raid_threshold INTEGER DEFAULT 10,

                anti_raid_window INTEGER DEFAULT 15,

                auto_lockdown INTEGER DEFAULT 0,

                lockdown_active INTEGER DEFAULT 0,

                min_account_age_days INTEGER DEFAULT 0,

                anti_spam_enabled INTEGER DEFAULT 1,

                anti_spam_threshold INTEGER DEFAULT 6,

                anti_spam_window INTEGER DEFAULT 8,

                anti_spam_sanction TEXT DEFAULT 'ban',

                anti_bot_enabled INTEGER DEFAULT 1,

                anti_nuke_enabled INTEGER DEFAULT 1,

                anti_nuke_threshold INTEGER DEFAULT 3,

                anti_nuke_threshold_channel INTEGER DEFAULT 3,

                anti_nuke_threshold_role INTEGER DEFAULT 3,

                anti_nuke_threshold_webhook INTEGER DEFAULT 2,

                anti_nuke_threshold_ban INTEGER DEFAULT 3,

                anti_nuke_window INTEGER DEFAULT 15,

                anti_nuke_sanction TEXT DEFAULT 'ban',

                quarantine_enabled INTEGER DEFAULT 0,

                quarantine_role_id TEXT,

                quarantine_account_age_days INTEGER DEFAULT 0,

                created_at INTEGER NOT NULL,

                updated_at INTEGER NOT NULL

            )
            `
        );


        // ======================================
        // INCIDENTS SÉCURITÉ
        // ======================================

        await run(
            `
            CREATE TABLE IF NOT EXISTS security_incidents (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                guild_id TEXT NOT NULL,

                incident_type TEXT NOT NULL,

                severity TEXT NOT NULL,

                description TEXT,

                metadata TEXT,

                status TEXT DEFAULT 'active',

                detected_at INTEGER NOT NULL,

                resolved_at INTEGER,

                resolved_by TEXT

            )
            `
        );


        // ======================================
        // PERMISSIONS LOCKDOWN
        // ======================================

        await run(
            `
            CREATE TABLE IF NOT EXISTS lockdown_permissions (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                guild_id TEXT NOT NULL,

                channel_id TEXT NOT NULL,

                role_id TEXT NOT NULL,

                allow_bits TEXT NOT NULL,

                deny_bits TEXT NOT NULL,

                created_at INTEGER NOT NULL,

                restored INTEGER DEFAULT 0,

                restored_at INTEGER,

                UNIQUE (
                    guild_id,
                    channel_id,
                    role_id,
                    restored
                )

            )
            `
        );


        // ======================================
        // WHITELIST ANTI-NUKE
        // ======================================

        await run(
            `
            CREATE TABLE IF NOT EXISTS anti_nuke_whitelist (

                guild_id TEXT NOT NULL,

                user_id TEXT NOT NULL,

                added_by TEXT,

                reason TEXT,

                created_at INTEGER NOT NULL,

                PRIMARY KEY (
                    guild_id,
                    user_id
                )

            )
            `
        );


        // ======================================
        // DOSSIERS DE MODÉRATION
        // ======================================

        await run(
            `
            CREATE TABLE IF NOT EXISTS moderation_cases (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                guild_id TEXT NOT NULL,

                user_id TEXT NOT NULL,

                actor_id TEXT,

                case_type TEXT NOT NULL,

                action TEXT NOT NULL,

                reason TEXT,

                metadata TEXT,

                status TEXT DEFAULT 'open',

                created_at INTEGER NOT NULL,

                resolved_at INTEGER

            )
            `
        );


        // ======================================
        // MIGRATIONS
        // ======================================

        await addColumnIfMissing(
            "member_history",
            "old_value",
            "TEXT"
        );


        await addColumnIfMissing(
            "member_history",
            "new_value",
            "TEXT"
        );


        await addColumnIfMissing(
            "guild_settings",
            "security_log_channel_id",
            "TEXT"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_raid_enabled",
            "INTEGER DEFAULT 1"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_raid_threshold",
            "INTEGER DEFAULT 10"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_raid_window",
            "INTEGER DEFAULT 15"
        );


        await addColumnIfMissing(
            "guild_settings",
            "auto_lockdown",
            "INTEGER DEFAULT 0"
        );


        await addColumnIfMissing(
            "guild_settings",
            "lockdown_active",
            "INTEGER DEFAULT 0"
        );


        await addColumnIfMissing(
            "guild_settings",
            "min_account_age_days",
            "INTEGER DEFAULT 0"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_spam_enabled",
            "INTEGER DEFAULT 1"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_spam_threshold",
            "INTEGER DEFAULT 6"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_spam_window",
            "INTEGER DEFAULT 8"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_spam_sanction",
            "TEXT DEFAULT 'ban'"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_bot_enabled",
            "INTEGER DEFAULT 1"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_nuke_enabled",
            "INTEGER DEFAULT 1"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_nuke_threshold",
            "INTEGER DEFAULT 3"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_nuke_threshold_channel",
            "INTEGER DEFAULT 3"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_nuke_threshold_role",
            "INTEGER DEFAULT 3"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_nuke_threshold_webhook",
            "INTEGER DEFAULT 2"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_nuke_threshold_ban",
            "INTEGER DEFAULT 3"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_nuke_window",
            "INTEGER DEFAULT 15"
        );


        await addColumnIfMissing(
            "guild_settings",
            "anti_nuke_sanction",
            "TEXT DEFAULT 'ban'"
        );


        await addColumnIfMissing(
            "guild_settings",
            "quarantine_enabled",
            "INTEGER DEFAULT 0"
        );


        await addColumnIfMissing(
            "guild_settings",
            "quarantine_role_id",
            "TEXT"
        );


        await addColumnIfMissing(
            "guild_settings",
            "quarantine_account_age_days",
            "INTEGER DEFAULT 0"
        );


        await addColumnIfMissing(
            "lockdown_permissions",
            "had_overwrite",
            "INTEGER DEFAULT 0"
        );


        // ======================================
        // INDEX NOM
        // ======================================

        await run(
            `
            CREATE INDEX IF NOT EXISTS
            idx_name_history_user

            ON name_history (
                guild_id,
                user_id
            )
            `
        );


        // ======================================
        // INDEX MEMBRE
        // ======================================

        await run(
            `
            CREATE INDEX IF NOT EXISTS
            idx_member_history_user

            ON member_history (
                guild_id,
                user_id
            )
            `
        );


        // ======================================
        // INDEX RÔLES
        // ======================================

        await run(
            `
            CREATE INDEX IF NOT EXISTS
            idx_role_history_user

            ON role_history (
                guild_id,
                user_id
            )
            `
        );


        // ======================================
        // INDEX INCIDENTS
        // ======================================

        await run(
            `
            CREATE INDEX IF NOT EXISTS
            idx_security_incidents_guild

            ON security_incidents (
                guild_id,
                status,
                detected_at
            )
            `
        );


        // ======================================
        // INDEX DOSSIERS
        // ======================================

        await run(
            `
            CREATE INDEX IF NOT EXISTS
            idx_moderation_cases_guild

            ON moderation_cases (
                guild_id,
                created_at
            )
            `
        );


        await run(
            `
            CREATE INDEX IF NOT EXISTS
            idx_moderation_cases_user

            ON moderation_cases (
                guild_id,
                user_id,
                created_at
            )
            `
        );


        // ======================================
        // INDEX LOCKDOWN
        // ======================================

        await run(
            `
            CREATE INDEX IF NOT EXISTS
            idx_lockdown_permissions

            ON lockdown_permissions (
                guild_id,
                restored
            )
            `
        );


        await run(
            `
            CREATE TABLE IF NOT EXISTS twitch_custom_commands (

                name TEXT PRIMARY KEY,

                response TEXT NOT NULL,

                cooldown_seconds INTEGER DEFAULT 5,

                mod_only INTEGER DEFAULT 0,

                created_at INTEGER NOT NULL,

                updated_at INTEGER NOT NULL

            )
            `
        );


        await run(
            `
            CREATE TABLE IF NOT EXISTS command_claims (

                message_id TEXT PRIMARY KEY,

                claimed_at INTEGER NOT NULL

            )
            `
        );


        console.log(
            "📋 Tables MiyuBot vérifiées et prêtes !"
        );

    } catch (error) {

        console.error(
            "❌ Erreur lors de l'initialisation de la base :",
            error
        );
    }
}


const databaseReady =
    initializeDatabase();


async function claimCommand(messageId) {
    if (!messageId) {
        return true;
    }

    try {
        await databaseReady;

        await run(
            `
            DELETE FROM command_claims
            WHERE claimed_at < ?
            `,
            [Date.now() - 15 * 60 * 1000]
        );

        await run(
            `
            INSERT INTO command_claims (
                message_id,
                claimed_at
            )
            VALUES (?, ?)
            `,
            [String(messageId), Date.now()]
        );

        return true;
    } catch (error) {
        const text = String(error && error.message || error);

        if (
            text.includes("UNIQUE") ||
            text.includes("constraint")
        ) {
            return false;
        }

        console.warn(
            "⚠️ claimCommand :",
            text
        );

        return true;
    }
}


async function createModerationCase(
    guildId,
    userId,
    actorId,
    caseType,
    action,
    reason,
    metadata = {}
) {
    if (!guildId || !userId || !caseType || !action) {
        return null;
    }

    await databaseReady;

    const result = await run(
        `
        INSERT INTO moderation_cases (
            guild_id,
            user_id,
            actor_id,
            case_type,
            action,
            reason,
            metadata,
            status,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            guildId,
            userId,
            actorId || null,
            caseType,
            action,
            reason || null,
            JSON.stringify(metadata || {}),
            "open",
            Date.now()
        ]
    );

    return result.lastID;
}


async function addWarning(guildId, userId, moderatorId, reason) {
    await databaseReady;

    const result = await run(
        `
        INSERT INTO warnings (
            guild_id,
            user_id,
            moderator_id,
            reason,
            created_at,
            active
        )
        VALUES (?, ?, ?, ?, ?, 1)
        `,
        [
            guildId,
            userId,
            moderatorId,
            reason || null,
            Date.now()
        ]
    );

    return result.lastID;
}


async function listWarnings(guildId, userId, limit = 10) {
    await databaseReady;

    return all(
        `
        SELECT id, moderator_id, reason, created_at, active
        FROM warnings
        WHERE guild_id = ?
        AND user_id = ?
        AND active = 1
        ORDER BY created_at DESC
        LIMIT ?
        `,
        [guildId, userId, limit]
    );
}


async function countWarnings(guildId, userId) {
    await databaseReady;

    const row = await get(
        `
        SELECT COUNT(*) AS total
        FROM warnings
        WHERE guild_id = ?
        AND user_id = ?
        AND active = 1
        `,
        [guildId, userId]
    );

    return Number(row?.total || 0);
}


module.exports = {
    db,
    run,
    get,
    all,
    databaseReady,
    claimCommand,
    createModerationCase,
    addWarning,
    listWarnings,
    countWarnings
};