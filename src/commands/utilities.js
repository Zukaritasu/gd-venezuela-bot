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

const { SlashCommandBuilder, ChatInputCommandInteraction, Client, InteractionCollector } = require('discord.js');
const { Db } = require('mongodb');

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

    if (subcommandGroup === 'top') {
        if (subcommand === 'xp') {
            await require('./utilities/xp').execute(database, interaction)
        } else if (subcommand === 'rank') {
            await require('./utilities/rank').execute(database, interaction)
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('utilidades')
        .setDescription('Utilidades del bot')
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup
                .setName('top')
                .setDescription('Top de jugadores en el servidor')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('xp')
                        .setDescription('Tabla de clasificación de los jugadores Top 15')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('rank')
                        .setDescription('Muestra tu posición en el Top 15')
                )
        ),
    execute,
};

