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

const { SlashCommandBuilder, ChatInputCommandInteraction, Client } = require('discord.js');
const { Db } = require('mongodb');
const gdvzlalistapi = require('../gdvzlalistapi')

//////////////////////////////////////////////////

/**
 * @param {Client} client 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(cliente, database, interaction) {
	const subcommand = interaction.options.getSubcommand();
	if (subcommand === 'enviar') {
		await require('./packs/submit').execute(cliente, database, interaction)
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('packs')
		.setDescription('Tus packs de niveles completados')
		.addSubcommand(input =>
			input
				.setName('enviar')
				.setDescription('Envia tu pack de niveles completados al staff')
				.addStringOption(option =>
                    option.setName('pack')
                        .setDescription('Nombre del pack')
                        .setRequired(true)
                        .setAutocomplete(true))
				.addStringOption(option =>
					option
						.setName('mensaje-id')
						.setDescription('ID del mensaje de contiene los archivos adjuntos')
						.setRequired(false)
				)
				.addStringOption(option =>
					option
						.setName('nivel-1')
						.setDescription('Enlace del nivel #1')
						.setRequired(false)
				)
				.addStringOption(option =>
					option
						.setName('nivel-2')
						.setDescription('Enlace del nivel #2')
						.setRequired(false)
				)
				.addStringOption(option =>
					option
						.setName('nivel-3')
						.setDescription('Enlace del nivel #3')
						.setRequired(false)
				)
		),
	async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        try {
            const packsNames = await gdvzlalistapi.getPacksNames()
            const filteredPacksNames = packsNames
                .filter(pack => pack.toLowerCase().includes(focusedValue.toLowerCase()))
                .map(pack => ({ name: pack, value: pack }))
                .slice(0, 25);

            await interaction.respond(filteredPacksNames);
        } catch (error) {
            logger.ERR(error);
            await interaction.respond([{ 
                name: 'Error al cargar el pack', 
                value: 'error' 
            }]);
        }
    },
	execute
}