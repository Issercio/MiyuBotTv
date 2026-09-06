function optionValue(interaction, option) {
    if (!option) {
        return null;
    }

    if (option.type === 6) {
        return interaction.options.getUser(option.name);
    }

    if (option.type === 8) {
        return interaction.options.getRole(option.name);
    }

    if (option.type === 7) {
        return interaction.options.getChannel(option.name);
    }

    if (option.type === 4) {
        return interaction.options.getInteger(option.name);
    }

    return interaction.options.getString(option.name);
}

function buildArgsFromInteraction(interaction, definition = {}) {
    const args = [];

    for (const option of definition.options || []) {
        const value = optionValue(interaction, option);

        if (value === null || value === undefined) {
            continue;
        }

        if (option.name === "parametres" || option.name === "action") {
            args.push(
                ...String(value).trim().split(/\s+/).filter(Boolean)
            );
            continue;
        }

        if (option.name === "valeur" || option.name === "raison" || option.name === "pseudo") {
            args.push(...String(value).trim().split(/\s+/).filter(Boolean));
            continue;
        }

        if (typeof value === "object" && value.id) {
            args.push(value.id);
            continue;
        }

        args.push(String(value));
    }

    return args;
}

function wrapInteraction(interaction) {
    return {
        isSlash: true,
        guild: interaction.guild,
        member: interaction.member,
        author: interaction.user,
        client: interaction.client,
        channel: interaction.channel,
        id: interaction.id,
        content: `/${interaction.commandName}`,
        mentions: {
            users: {
                first: () => {
                    try {
                        return interaction.options.getUser("membre");
                    } catch (error) {
                        return null;
                    }
                }
            },
            roles: {
                first: () => {
                    try {
                        return interaction.options.getRole("role");
                    } catch (error) {
                        return null;
                    }
                }
            }
        },
        async reply(payload) {
            const data =
                typeof payload === "string"
                    ? { content: payload }
                    : payload;

            if (interaction.deferred && !interaction.replied) {
                return interaction.editReply(data);
            }

            if (interaction.replied) {
                return interaction.followUp(data);
            }

            return interaction.reply(data);
        },
        async delete() {
            return null;
        }
    };
}

module.exports = {
    buildArgsFromInteraction,
    wrapInteraction
};
