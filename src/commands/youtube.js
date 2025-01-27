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
const logger = require('../logger');


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
    try {
        await interaction.reply('Este comando está deshabilitado temporalmente')
    } catch (err) {
        logger.ERR(err)
    }
    //const subcommand = interaction.options.getSubcommand();

    /*if (subcommand === 'notification') {
        await require('./youtube/register-notification').execute(database, client, interaction)
    } else if (subcommand === 'help') {
        await require('./youtube/help').execute(client, database, interaction)
    } else if (subcommand === 'list') {
        await require('./youtube/list').execute(database, interaction)
    } else if (subcommand === 'remove') {
        await require('./youtube/remove-notification').execute(database, interaction)
    }*/
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('youtube')
        .setDescription('Comandos relacionados con YouTube')

        .addSubcommand(subcommand =>
            subcommand
                .setName('notification')
                .setDescription('Configura notificaciones de nuevos videos de un canal de YouTube (Desuso)')
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
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('help')
                .setDescription('Muestra el mensaje de ayuda (Desuso)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Muestra la lista de canales de YouTube registrados (Desuso)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Quita un canal de YouTube de la lista (Desuso)')
                .addStringOption(option =>
                    option
                        .setName('username')
                        .setDescription('Nombre de usuario')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('channel_id')
                        .setDescription('Canal de YouTube')
                        .setRequired(true)
                )
        ),
    execute
};