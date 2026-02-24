/**
 * Copyright (C) 2025 Zukaritasu
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

const { SlashCommandBuilder, ChatInputCommandInteraction, Client, InteractionCollector } = require('discord.js');
const { Db } = require('mongodb');
const topLimits = require('../../.botconfig/top-limits.json');

//
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//

/**
 * 
 * @param {Client} _client 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, database, interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === 'usuario') {
        if (subcommand === 'posicion') {
            await require('./text-xp/user').position(database, interaction)
        } else if (subcommand === 'salir') {
            await require('./text-xp/user').leave(database, interaction)
        } else if (subcommand === 'unirse') {
            await require('./text-xp/user').join(database, interaction)
        }
    } else {
        if (subcommand === 'help') {
            await require('./text-xp/help').execute(database, interaction)
        } else if (subcommand === 'leaderboard') {
            await require('./text-xp/leaderboard').execute(database, interaction)
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('textxp')
        .setDescription('Experiencia de Texto')
        .addSubcommand(subcommand =>
            subcommand
                .setName('help')
                .setDescription('Muestra la ayuda del comando textxp')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('Tabla de clasificación de los usuarios')
                .addNumberOption(option =>
                    option
                        .setName('pagina')
                        .setDescription('Número de página del leaderboard')
                        .setMinValue(1)
                )
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup
                .setName('usuario')
                .setDescription('Comandos relacionados con el usuario')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('posicion')
                        .setDescription(`Muestra tu posición en el Top`)
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('salir')
                        .setDescription('Salir del sistema de experiencia de texto')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('unirse')
                        .setDescription('Unirse al sistema de experiencia de texto')
                )
        ),
    execute,
};

