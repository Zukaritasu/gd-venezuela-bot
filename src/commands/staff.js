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
    if (subcommand === 'cp_jugador') {
        await require('./staff/save-cp-player').execute(client, database, interaction)
    } else if (subcommand === 'hardest') {
        await require('./staff/set-hardest').execute(client, database, interaction)
    } else if (subcommand === 'estado_hardest') {
        await require('./staff/set-state-hardest').execute(client, database, interaction)
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff')
        .setDescription('Comandos de uso exclusivo para el Staff del servidor.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('cp_jugador')
                .setDescription('Guarda un jugador con puntos de creador (solo personal autorizado)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('hardest')
                .setDescription('Define el hardest del país (solo personal autorizado)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('estado_hardest')
                .setDescription('Nivel más difícil completado en el estado (solo personal autorizado)')),
    execute,
};