const {
    PermissionFlagsBits
} = require("discord.js");

const {
    resolveMember,
    canActOn
} = require("../../moderation/helpers");

const {
    sendSecurityLog
} = require("../../security/securityLogger");

module.exports = {
    name: "nick",
    aliases: ["nickname"],
    description: "Change le pseudo d'un membre",
    permission: PermissionFlagsBits.ManageNicknames,

    async execute(message, args) {
        if (!message.guild) {
            return message.reply("❌ Utilise cette commande sur un serveur.");
        }

        const { member, user } = await resolveMember(message, args.shift());

        if (!member || !user) {
            return message.reply("Usage : `!nick @membre [nouveau pseudo|reset]`");
        }

        const hierarchy = canActOn(message.member, member);

        if (!hierarchy.ok && member.id !== message.author.id) {
            return message.reply(`❌ ${hierarchy.error}`);
        }

        if (!member.manageable) {
            return message.reply("❌ MiyuBot ne peut pas changer le pseudo de ce membre.");
        }

        const next = args.join(" ").trim();
        const nickname =
            !next || next.toLowerCase() === "reset" || next.toLowerCase() === "clear"
                ? null
                : next.slice(0, 32);

        const previous = member.nickname || member.user.username;

        await member.setNickname(
            nickname,
            `${message.author.tag} via !nick`
        );

        await sendSecurityLog(message.guild, {
            title: "Nickname Updated",
            level: "info",
            actor: message.author,
            target: user,
            fields: [
                {
                    name: "Before",
                    value: previous,
                    inline: true
                },
                {
                    name: "After",
                    value: nickname || user.username,
                    inline: true
                }
            ]
        });

        return message.reply(
            nickname
                ? `✏️ Pseudo de **${user.tag}** → \`${nickname}\``
                : `✏️ Pseudo de **${user.tag}** réinitialisé.`
        );
    }
};
