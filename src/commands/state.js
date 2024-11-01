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

const statistics = require('../../resources/stadistics.json')


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

    if (subcommandGroup === 'grinders') {
        if (subcommand === 'moon') {
            await require('./state/statistics').processStateStatistics(client, database, interaction, statistics.MOON_GRINDER)
        } else if (subcommand === 'star') {
            await require('./state/statistics').processStateStatistics(client, database, interaction, statistics.STAR_GRINDER)
        } else if (subcommand === 'demon') {
            await require('./state/statistics').processStateStatistics(client, database, interaction, statistics.DEMON_GRINDER)
        } else if (subcommand === 'user_coin') {
            await require('./state/statistics').processStateStatistics(client, database, interaction, statistics.USER_COIN_GRINDER)
        }
    }

    else if (subcommand === 'info') {
        await require('./state/info').execute(client, database, interaction)
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('estado')
        .setDescription('Información relacionada a un Estado del pais')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Muestra la información de un Estado del país'))
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup
                .setName('grinders')
                .setDescription('Jugadores de un Estado que se dedican a grindear')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('moon')
                        .setDescription('Jugadores dedicados a grindear lunas')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('star')
                        .setDescription('Jugadores dedicados a grindear estrellas')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('demon')
                        .setDescription('Jugadores dedicados a grindear demons')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('user_coin')
                        .setDescription('Jugadores dedicados a grindear user coin')
                )
        ),
    execute,
};