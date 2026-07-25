/**
 * Copyright (C) 2025 - 2026 Zukaritasu
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

const { SlashCommandBuilder, Client, ChatInputCommandInteraction, MessageFlags, EmbedBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, ComponentType, ModalBuilder } = require("discord.js");
const { Db } = require("mongodb");
const logger = require('../logger')
const channels = require('../../.botconfig/channels.json')

/**
 * Shows a modal allowing the user to send a response to the staff.
 * If the user is a member of the forbidden guild, the command is denied.
 * If the `mensaje` option is provided, the modal can be prefilled with it.
 *
 * @param {Client} client - Discord client instance.
 * @param {Db} _ - Database connection (unused).
 * @param {ChatInputCommandInteraction} interaction - The command interaction.
 */
async function execute(client, _, interaction) {
	try {
		const forbiddenGuild = client.guilds.cache.get(process.env.SERVER_GD_VENEZUELA_ID);
		if (!forbiddenGuild) {
			throw new Error(`Guild not found: ${process.env.SERVER_GD_VENEZUELA_ID}`);
		}

		if (interaction.user.id !== '591640548490870805' /* zukaritasu id */) {
			try {
				const member = await forbiddenGuild.members.fetch(interaction.user.id);
				if (member) {
					return await interaction.reply({
						content: 'El comando no está disponible en este servidor.',
						flags: MessageFlags.Ephemeral
					});
				}
			} catch (err) {
				logger.DBG('member fetch failed in user-response.execute:', err);
			}
		}

		const modal = new ModalBuilder()
			.setCustomId('userResponse')
			.setTitle('Enviar una respuesta al Staff');
		
		const label = new LabelBuilder(
            {
                description: 'Escribe una respuesta detallada. El staff puede tardar un poco en responderte.',
                label: 'Respuesta',
                component: new TextInputBuilder({
                    customId: 'dmContent',
                    style: TextInputStyle.Paragraph,
                    required: true
                })
            }
        )

		modal.addLabelComponents(label)

		await interaction.showModal(modal);
	} catch (error) {
		logger.ERR(error)
		try {
			await interaction.reply({
				content: 'Ha ocurrido un error inesperado. Inténtalo más tarde.',
				flags: MessageFlags.Ephemeral
			})
		} catch {

		}
	}
}

/**
 * Processes the modal submission: builds an embed and sends it to the moderation channel.
 * Replies to the user confirming the submission.
 *
 * @param {ChatInputCommandInteraction} interaction - The submitted modal interaction.
 * @param {Client} client - Discord client instance.
 */
async function handleModalSubmit(interaction, client) {
	try {
		const dmContent = interaction.fields.getTextInputValue('dmContent')

		const channelModeration = await client.channels.fetch(channels.MODERATION)
		if (!channelModeration) {
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

		await channelModeration.send({ embeds: [ embed ] })

		await interaction.reply({
			content: 'Respuesta enviada con éxito!',
			flags: MessageFlags.Ephemeral
		})
	} catch (error) {
		logger.ERR(error)
		try {
			await interaction.reply({
				content: 'Ha ocurrido un error inesperado. Inténtalo más tarde.',
				flags: MessageFlags.Ephemeral
			})
		} catch {

		}
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('responder')
		.setDescription('Responde de vuelta a un mensaje del Staff'),
	execute,
	handleModalSubmit
};