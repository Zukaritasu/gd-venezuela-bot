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
        if (interaction.isChatInputCommand()) {
            if (interaction.guild) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (command !== null)
                    await command.execute(client, database, interaction);
            } else {
                console.error("Guild is null. The bot might not be in the server or lacks the necessary permissions.");
                await interaction.reply(
                    {
                        content: 'Error al consultar la información del servidor'
                    }
                );
            }
        }
    },
};