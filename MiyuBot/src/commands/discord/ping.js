const os = require("os");

module.exports = {
    name: "ping",
    description: "Teste si MiyuBot répond",

    execute(message) {
        const instance = process.env.FLY_MACHINE_ID
            ? `fly/${process.env.FLY_REGION || "?"}/${String(process.env.FLY_MACHINE_ID).slice(0, 8)}`
            : `local/${os.hostname()}`;

        return message.reply(
            `🏓 Pong ! \`${instance}\``
        );
    }
};
