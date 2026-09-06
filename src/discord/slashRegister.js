const {
    SlashCommandBuilder,
    ApplicationCommandOptionType,
    PermissionFlagsBits
} = require("discord.js");

const definitions = require("./slashDefinitions");

function addOption(builder, option) {
    const name = option.name;
    const description = option.description || name;
    const required = Boolean(option.required);

    if (option.type === ApplicationCommandOptionType.User) {
        builder.addUserOption((item) =>
            item.setName(name).setDescription(description).setRequired(required)
        );
        return;
    }

    if (option.type === ApplicationCommandOptionType.String) {
        builder.addStringOption((item) =>
            item.setName(name).setDescription(description).setRequired(required)
        );
        return;
    }

    if (option.type === ApplicationCommandOptionType.Integer) {
        builder.addIntegerOption((item) => {
            item.setName(name).setDescription(description).setRequired(required);

            if (Number.isInteger(option.minValue)) {
                item.setMinValue(option.minValue);
            }

            if (Number.isInteger(option.maxValue)) {
                item.setMaxValue(option.maxValue);
            }

            return item;
        });
        return;
    }

    if (option.type === ApplicationCommandOptionType.Channel) {
        builder.addChannelOption((item) =>
            item.setName(name).setDescription(description).setRequired(required)
        );
        return;
    }

    if (option.type === ApplicationCommandOptionType.Role) {
        builder.addRoleOption((item) =>
            item.setName(name).setDescription(description).setRequired(required)
        );
    }
}

function uniqueCommands(commandCollection) {
    const unique = new Map();

    for (const command of commandCollection.values()) {
        if (!unique.has(command.name)) {
            unique.set(command.name, command);
        }
    }

    return unique;
}

function defaultPermissions(command) {
    if (["help", "ping", "userinfo"].includes(command.name)) {
        return null;
    }

    return command.permission || PermissionFlagsBits.Administrator;
}

function buildSlashPayload(commandCollection) {
    const unique = uniqueCommands(commandCollection);
    const builders = [];
    const names = new Set();

    function push(name, command) {
        if (names.has(name) || !definitions[name]) {
            return;
        }

        names.add(name);

        const spec = definitions[name];
        const builder = new SlashCommandBuilder()
            .setName(name)
            .setDescription(spec.description || command.description || name);

        const perms = defaultPermissions(command);

        if (perms) {
            builder.setDefaultMemberPermissions(perms);
        }

        for (const option of spec.options || []) {
            addOption(builder, option);
        }

        builders.push(builder);
    }

    for (const command of unique.values()) {
        push(command.name, command);

        for (const alias of command.aliases || []) {
            push(String(alias).toLowerCase(), command);
        }
    }

    return builders.map((builder) => builder.toJSON());
}

async function registerGuildSlashCommands(client) {
    const payload = buildSlashPayload(client.commands);

    for (const guild of client.guilds.cache.values()) {
        await guild.commands.set(payload);
        console.log(
            `Slash: ${payload.length} commandes enregistrées sur ${guild.name}`
        );
    }

    return payload;
}

module.exports = {
    buildSlashPayload,
    registerGuildSlashCommands
};
