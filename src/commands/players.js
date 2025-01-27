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
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === 'demonlist') {
        if (subcommand === 'retirados') {
            await require('./players/demonlist-players-removed').execute(client, database, interaction)
        } else if (subcommand === 'activos') {
            await require('./players/demonlist-players').execute(client, database, interaction)
        } else if (subcommand === 'estadisticas') {
            await require('./players/demonlist-players-statistics').execute(database, interaction)
        } else if (subcommand === 'puntuaciones') {
            await require('./players/demonlist-players-scores').execute(interaction)
        }
    }

    else if (subcommand === 'cantidad') {
        await require('./players/count-players').execute(client, database, interaction)
    } else if (subcommand === 'creatorpoints') {
        await require('./players/creator-point-players').execute(client, database, interaction)
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
                .setName('creatorpoints')
                .setDescription('Lista de Jugadores con puntos de creador'))
        .addSubcommandGroup(subCommandGroup =>
            subCommandGroup.setName('demonlist')
                .setDescription('Demonlist')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('retirados')
                        .setDescription('Lista de Jugadores retirados de la Demonlist'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('activos')
                        .setDescription('Lista de Jugadores activos de la Demonlist'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('estadisticas')
                        .setDescription('Estadisticas de los Jugadores de la Demonlist'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('puntuaciones')
                        .setDescription('Listado de puntuaciones de los jugadores'))
        ),
    execute,
};