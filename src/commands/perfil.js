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

const { SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');

/**
 * @param {*} client 
 * @param {*} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(client, database, interaction) {
	const subcommand = interaction.options.getSubcommand();

	if (subcommand === 'ver') {
		await require('./perfil/view').view(client, database, interaction);
	} else if (subcommand === 'configurar') {
		await require('./perfil/configure').configure(client, database, interaction);
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('perfil')
		.setDescription('Muestra el perfil del usuario')
		.addSubcommand(subcommand =>
			subcommand
				.setName('ver')
				.setDescription('Muestra el perfil de un usuario')
				.addUserOption(option =>
					option
						.setName('usuario')
						.setDescription('El usuario cuyo perfil deseas ver')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('configurar')
				.setDescription('Configura tu perfil')
				.addStringOption(option =>
					option
						.setName('descripcion')
						.setDescription('La descripción que deseas establecer')
						.setRequired(false)
						.setMaxLength(320))
				.addIntegerOption(option =>
					option
						.setName('dia')
						.setDescription('El día de tu cumpleaños')
						.setRequired(false)
						.setMinValue(0)
						.setMaxValue(31))
				.addIntegerOption(option =>
					option
						.setName('mes')
						.setDescription('El mes de tu cumpleaños')
						.setRequired(false)
						.setMinValue(0)
						.setMaxValue(12))
				.addStringOption(option =>
					option
						.setName('hardest-video')
						.setDescription('El link del video de tu hardest (Youtube)')
						.setRequired(false))
				.addStringOption(option =>
					option
						.setName('hardest-nombre')
						.setDescription('El nombre de tu hardest')
						.setRequired(false))
				.addStringOption(option =>
					option
						.setName('color')
						.setDescription('El color en formato hexadecimal (Ejemplo: #FF5733)')
						.setRequired(false))
				.addStringOption(option =>
					option
						.setName('youtube-channel')
						.setDescription('El link de tu canal de YouTube')
						.setRequired(false))
				.addStringOption(option =>
					option
						.setName('twitch-channel')
						.setDescription('El link de tu canal de Twitch')
						.setRequired(false))
				.addStringOption(option =>
					option
						.setName('twitter-profile')
						.setDescription('El link de tu perfil de Twitter')
						.setRequired(false))
				.addStringOption(option =>
					option
						.setName('tiktok-profile')
						.setDescription('El link de tu perfil de TikTok')
						.setRequired(false))),
			execute
}