/**
 * Copyright (C) 2024 Zukaritasu
 * 
 * his program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const { Events, Client, ChatInputCommandInteraction } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../logger')
const activity = require('../commands/leveling/activity');

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    /**
     * 
     * @param {Client} client 
     * @param {Db} database 
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(client, database, interaction) {
        try {
            if (interaction.isChatInputCommand()) {
                if (interaction.guild) {
                    activity.log(database, interaction.guild, "", false, interaction.user.id, interaction.user.username);
                    await interaction.client.commands
                        .get(interaction.commandName)
                        ?.execute(client, database, interaction);
                } else if (interaction.commandName === 'verify') {
                    await require('../commands/user-verification').execute(client, database, interaction);
                } else if (interaction.commandName === 'responder') {
                    await require('../commands/user-response').execute(client, database, interaction);
                }  else if (interaction.commandName === 'packs') {
                    await require('../commands/packs').execute(client, database, interaction);
                } else {
                    await interaction.reply({
                            content: 'Este comando no se puede ejecutar por mensaje directo. Intenta ejecutarlo en GD Venezuela.'
                        }
                    );
                }
            } else if (interaction.isAutocomplete()) {
                const command = client.commands.get(interaction.commandName);
                if (!command || !command.autocomplete) 
                    return;
                await command.autocomplete(interaction);
            }

        } catch (error) {
            logger.ERR(error)
        }
    },
};