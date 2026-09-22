/**
 * Copyright (C) 2026 Zukaritasu
 * 
 * This program is free software: you can redistribute it and/or modify
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

const { SlashCommandBuilder, Client, ChatInputCommandInteraction } = require("discord.js");
const { Db } = require("mongodb");

/**
 * 
 * @param {Client} _ 
 * @param {Db} _ 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_, _, interaction) {
	const subcommand = interaction.options.getSubcommand();

	if (subcommand === 'notificar') {
		await require('./tiktok/notifications').notify(interaction);
	}
}

module.exports = {
	execute,
	data: new SlashCommandBuilder()
		.setDescription('TikTok Notificaciones')
		.setName('tiktok')
		.addSubcommand(sub => sub
			.setName('notificar')
			.setDescription('Notificar un nuevo vídeo de TikTok')
			.addStringOption(op => op
				.setDescription('Id o link del vídeo')
				.setName('video')
				.setRequired(true)
			)
		)
}