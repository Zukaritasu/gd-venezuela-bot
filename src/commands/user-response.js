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

const { SlashCommandBuilder, Client, ChatInputCommandInteraction, MessageFlags, EmbedBuilder } = require("discord.js");
const { Db } = require("mongodb");
const logger = require('../logger')
const channels = require('../../.botconfig/channels.json')

/**
 * 
 * @param {Client} client 
 * @param {Db} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(client, _database, interaction) {
	try {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral })
		const forbiddenGuild = client.guilds.cache.get('1119795689984102455'); // GD Venezuela ID
		if (forbiddenGuild && interaction.user.id !== '591640548490870805' /* zukaritasu id */) {
			try {
				const member = await forbiddenGuild.members.fetch(interaction.user.id);
				if (member) {
					return await interaction.editReply({
						content: 'El comando no está disponible en este servidor.',
					});
				}
			} catch {

			}
		}

		const dmContent = interaction.options.getString('mensaje')
		if (!dmContent) return
		const chModeration = await client.channels.fetch(channels.MODERATION)
		if (!chModeration) {
			throw new Error('Channel not found');
		}

		const embed = new EmbedBuilder()
		embed.setColor(0x2b2d31)
		embed.setTitle(interaction.user.tag)
		embed.setDescription(`${dmContent}`)
		embed.setThumbnail(interaction.user.displayAvatarURL({ size: 128, extension: 'png' }))
		embed.setFields(
			{
				name: 'User ID',
				value: interaction.user.id,
				inline: true
			},
			{
				name: 'Message Type',
				value: 'DM Response',
				inline: true
			}
		)

		await chModeration.send({ embeds: [ embed ] })
		await interaction.editReply(`Respuesta enviada con éxito!`)
	} catch (error) {
		logger.ERR(error)
		try {
			await interaction.editReply(`Ha ocurrido un error inesperado. Inténtalo más tarde.`)
		} catch {

		}
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('responder')
		.setDescription('Responde de vuelta a un mensaje del Staff')
		.addStringOption(option =>
			option.setName('mensaje')
				.setDescription('Mensaje que será enviado al Staff')
				.setRequired(true)
		),
	execute
};