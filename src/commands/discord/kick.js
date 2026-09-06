const {
    PermissionFlagsBits
} = require("discord.js");

const {
    resolveMember,
    canActOn,
    botCanAct,
    extractReason,
    recordAndLog
} = require("../../moderation/helpers");

module.exports = {
    name: "kick",
    description: "Expulse un membre",
    permission: PermissionFlagsBits.KickMembers,

    async execute(message, args) {
        if (!message.guild) {
            return message.reply("❌ Utilise cette commande sur un serveur.");
        }

        const { member, user } = await resolveMember(message, args.shift());

        if (!member || !user) {
            return message.reply("Usage : `/kick` + membre");
        }

        const hierarchy = canActOn(message.member, member);

        if (!hierarchy.ok) {
            return message.reply(`❌ ${hierarchy.error}`);
        }

        const botCheck = botCanAct(member, "kick");

        if (!botCheck.ok) {
            return message.reply(`❌ ${botCheck.error}`);
        }

        const reason = extractReason(args);

        await member.kick(`${message.author.tag}: ${reason}`);

        const caseId = await recordAndLog(message.guild, {
            target: user,
            actor: message.author,
            title: "Member Kicked",
            level: "danger",
            caseType: "moderation",
            action: "kick",
            reason
        });

        return message.reply(
            `👢 **${user.tag}** a été expulsé.${caseId ? ` Dossier \`#${caseId}\`.` : ""}`
        );
    }
};
