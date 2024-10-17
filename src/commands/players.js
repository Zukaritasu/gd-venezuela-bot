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

const { SlashCommandBuilder, ChatInputCommandInteraction} = require('discord.js');


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
    if (subcommand === 'cantidad') {
        await require('./players/count-players').execute(client, database, interaction)
    } else if (subcommand === 'cp') {
        await require('./players/creator-point-players').execute(client, database, interaction)
    } else if (subcommand === 'demonlist') {
        await require('./players/demonlist-players').execute(client, database, interaction)
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jugadores')
        .setDescription('Muestra información de los jugadores del país')
        .addSubcommand(subcommand =>
            subcommand
                .setName('cantidad')
                .setDescription('Cantidad de jugadores por estado del país'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cp')
                .setDescription('Lista de Jugadores con puntos de creador'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('demonlist')
                .setDescription('Lista de Jugadores de la Demonlist')),
    execute,
};