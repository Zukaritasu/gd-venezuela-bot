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

const { SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');


//
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//

/**
 * 
 * @param {*} client 
 * @param {*} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(client, database, interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'notification') {
        await require('./youtube/register-notification').execute(database, client, interaction)
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('youtube')
        .setDescription('Comandos relacionados con YouTube')
    
        .addSubcommand(subcommand =>
            subcommand
                .setName('notification')
                .setDescription('Configura notificaciones de nuevos videos de un canal de YouTube')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Rol al que se notificará')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('username')
                        .setDescription('Nombre de usuario')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('Descripción')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Canal de YouTube')
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Usuario')
                        .setRequired(false)
                )
            ),
    execute,
};