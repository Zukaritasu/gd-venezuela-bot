/**
 * Copyright (C) 2026 Zukaritasu
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

const { SlashCommandBuilder } = require("discord.js");

/**
 * Executes the appropriate game command based on the subcommand and subcommand group.
 * @param {import("discord.js").Client} _client - The Discord client instance
 * @param {import("mongodb").Db} _db - The MongoDB database instance
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - The command interaction object
 */
async function execute(_client, _db, interaction) {
	const subcommand = interaction.options.getSubcommand();

	if (subcommand === 'configurar') {
		await require('./youtube/notifications').configureYoutubeNotifications(interaction);
	} else if (subcommand === 'desactivar') {
		await require('./youtube/notifications').setEnabled(interaction, false);
	} else if (subcommand === 'activar') {
		await require('./youtube/notifications').setEnabled(interaction, true);
	} else if (subcommand === 'testear') {
		await require('./youtube/notifications').testNotification(interaction);
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('youtube')
		.setDescription('Canales de YouTube')
		/* .addSubcommand(subcommand =>
			subcommand
				.setName('configurar')
				.setDescription('Configura tu notificacion')
				.addStringOption(option =>
					option
						.setName('channel_name')
						.setDescription('Define el nombre de tu canal de YouTube')
				)
				.addStringOption(option =>
					option
						.setName('channel_id')
						.setDescription('Link de tu canal de YouTube')
				)
				.addStringOption(option =>
					option
						.setName('message_video')
						.setDescription('Mensaje de tu notificacion cuando subes un video')
				)
				.addStringOption(option =>
					option
						.setName('message_stream')
						.setDescription('Mensaje de tu notificacion cuando inicias directo')
				)
		) */
		.addSubcommand(subcommand =>
			subcommand
				.setName('configurar')
				.setDescription('Configurar las notificaciones de YouTube')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('desactivar')
				.setDescription('Desactiva las notificaciones cuando subes un video')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('activar')
				.setDescription('Activa las notificaciones cuando subes un video')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('testear')
				.setDescription('Visualiza como se ve cuando llega un nuevo video o stream')
				.addStringOption(option =>
					option
						.setName('type')
						.setDescription('Video o Stream')
						.addChoices(
							{ name: 'Video', value: 'video' },
							{ name: 'Stream', value: 'stream' }
						)
				)
		),
	execute
};