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
const aredlapi = require('../aredlapi');
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
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'sumit') {
        await require('./records/submit').execute(client, database, interaction)
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('records')
        .setDescription('Tus niveles completados')
        .addSubcommand(subcommand =>
            subcommand
                .setName('submit')
                .setDescription('Envia tu progreso en el nivel')
                .addStringOption(option =>
                    option.setName('player')
                        .setDescription('Nombre del jugador')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('level')
                        .setDescription('Nombre del nivel')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(option =>
                    option.setName('ytvideo')
                        .setDescription('Enlace del video de YouTube')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('comment')
                        .setDescription('Agrega un comentario')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('mobile')
                        .setDescription('Juegas en movil?')
                        .setRequired(false))),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        try {
            const levels = await aredlapi.getLevels();
            logger.DBG('Levels:', levels);
            const filteredLevels = levels
                .filter(level => level.name.toLowerCase().includes(focusedValue.toLowerCase()))
                .map(level => ({ name: level.name, value: level.name }));

            await interaction.respond(filteredLevels);
        } catch (error) {
            logger.ERR('Error al cargar niveles:', error);
            await interaction.respond([{ name: 'Error al cargar niveles', value: 'error' }]);
        }
    },
                    
    execute,
};