const {
    ApplicationCommandOptionType
} = require("discord.js");

const USER = ApplicationCommandOptionType.User;
const STRING = ApplicationCommandOptionType.String;
const INTEGER = ApplicationCommandOptionType.Integer;
const CHANNEL = ApplicationCommandOptionType.Channel;

function userOpt(name, description, required = true) {
    return { name, description, type: USER, required };
}

function strOpt(name, description, required = false) {
    return { name, description, type: STRING, required };
}

function intOpt(name, description, required = true, min, max) {
    return {
        name,
        description,
        type: INTEGER,
        required,
        minValue: min,
        maxValue: max
    };
}

module.exports = {
    ping: { description: "Vérifie si MiyuBot répond" },
    help: { description: "Liste des commandes MiyuBot" },
    userinfo: {
        description: "Fiche d'un membre",
        options: [userOpt("membre", "Membre à inspecter", false)]
    },
    ban: {
        description: "Bannit un membre",
        options: [userOpt("membre", "Membre à bannir"), strOpt("raison", "Raison")]
    },
    unban: {
        description: "Révoque un bannissement",
        options: [strOpt("utilisateur", "ID Discord", true), strOpt("raison", "Raison")]
    },
    kick: {
        description: "Expulse un membre",
        options: [userOpt("membre", "Membre à expulser"), strOpt("raison", "Raison")]
    },
    timeout: {
        description: "Timeout / mute un membre",
        options: [
            userOpt("membre", "Membre"),
            strOpt("duree", "Ex: 10m, 1h, 1d"),
            strOpt("raison", "Raison")
        ]
    },
    mute: {
        description: "Alias de /timeout",
        options: [
            userOpt("membre", "Membre"),
            strOpt("duree", "Ex: 10m, 1h, 1d"),
            strOpt("raison", "Raison")
        ]
    },
    untimeout: {
        description: "Retire un timeout",
        options: [userOpt("membre", "Membre"), strOpt("raison", "Raison")]
    },
    unmute: {
        description: "Alias de /untimeout",
        options: [userOpt("membre", "Membre"), strOpt("raison", "Raison")]
    },
    warn: {
        description: "Avertit un membre",
        options: [userOpt("membre", "Membre"), strOpt("raison", "Raison")]
    },
    warnings: {
        description: "Liste les avertissements",
        options: [userOpt("membre", "Membre", false)]
    },
    warns: {
        description: "Alias de /warnings",
        options: [userOpt("membre", "Membre", false)]
    },
    softban: {
        description: "Ban + unban pour purger 24h de messages",
        options: [userOpt("membre", "Membre"), strOpt("raison", "Raison")]
    },
    nick: {
        description: "Change le pseudo d'un membre",
        options: [userOpt("membre", "Membre"), strOpt("pseudo", "Nouveau pseudo, ou reset")]
    },
    nickname: {
        description: "Alias de /nick",
        options: [userOpt("membre", "Membre"), strOpt("pseudo", "Nouveau pseudo, ou reset")]
    },
    purge: {
        description: "Supprime des messages du salon",
        options: [intOpt("nombre", "Entre 1 et 100", true, 1, 100)]
    },
    clear: {
        description: "Alias de /purge",
        options: [intOpt("nombre", "Entre 1 et 100", true, 1, 100)]
    },
    prune: {
        description: "Alias de /purge",
        options: [intOpt("nombre", "Entre 1 et 100", true, 1, 100)]
    },
    slowmode: {
        description: "Mode lent du salon",
        options: [intOpt("secondes", "0 pour désactiver", true, 0, 21600)]
    },
    slow: {
        description: "Alias de /slowmode",
        options: [intOpt("secondes", "0 pour désactiver", true, 0, 21600)]
    },
    lockdown: {
        description: "Verrouille le serveur",
        options: [strOpt("raison", "Raison")]
    },
    unlock: {
        description: "Retire le lockdown",
        options: [strOpt("raison", "Raison")]
    },
    setupcheck: { description: "Vérifie la config de sécurité" },
    syncmembers: { description: "Synchronise les membres en base" },
    config: {
        description: "Configuration sécurité (raid, spam, âge, logs…)",
        options: [
            strOpt("parametres", "Ex: show, age 30, raid on, logs off", false),
            { name: "salon", description: "Salon (pour logs)", type: CHANNEL, required: false },
            {
                name: "role",
                description: "Rôle (pour quarantaine)",
                type: ApplicationCommandOptionType.Role,
                required: false
            }
        ]
    },
    securitylogs: {
        description: "Salon de logs MiyuBot",
        options: [strOpt("action", "create, test, off ou info", false)]
    },
    antinuke: {
        description: "Réglages anti-nuke",
        options: [
            strOpt("action", "status, on, off, threshold, window, sanction", false),
            strOpt("valeur", "Nombre ou ban/kick/timeout")
        ]
    },
    whitelist: {
        description: "Whitelist anti-nuke",
        options: [
            strOpt("action", "add, remove, list", false),
            userOpt("membre", "Membre", false),
            strOpt("raison", "Raison")
        ]
    },
    cases: {
        description: "Dossiers de modération",
        options: [
            strOpt("action", "recent ou user", false),
            userOpt("membre", "Membre", false),
            intOpt("nombre", "Nombre de dossiers", false, 1, 25)
        ]
    }
};
