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

const { Client, ChatInputCommandInteraction, MessageFlags, ChannelType, EmbedBuilder } = require('discord.js')
const logger = require('../../logger')
const utils = require('../../utils')
const channels = require('../../../.botconfig/channels.json')
const { COLL_GDVZLA_LIST_PROFILES } = require('../../../.botconfig/database-info.json')
const { Db } = require('mongodb')

//////////////////////////////////////////////

const GD_VENEZUELA_GUILD_ID = '1119795689984102455';
const VENEZUELAN_ROLE_ID = '1119804850620866600';

/**
 * 
 * @param {Client} client
 * @param {ChatInputCommandInteraction} interaction 
 */
async function verifyConditionsToContinue(client, interaction) {
	if (interaction.guildId) {
		await interaction.editReply({
			content: 'Comando de uso exclusivo en DM (mensaje directo)',
		});
		return false
	}

	const guild = client.guilds.cache.get(GD_VENEZUELA_GUILD_ID);
	if (guild) {
		try {
			const member = await guild.members.fetch(interaction.user.id);
			if (!member) {
				return await interaction.editReply({
					content: 'No se pudo verificar tu membresía. Asegúrate de estar en el servidor de GD Venezuela'
				});
			}

			if (member.roles.cache.has(VENEZUELAN_ROLE_ID))
				return true
			return await interaction.editReply({
				content: 'Comando disponible solo para Venezolanos.'
			});
		} catch (err) {
			logger.ERR(err)
		}
	}

	return false
}

/**
 * @param {Client} client
 * @param {string[]} levels 
 * @param {ChatInputCommandInteraction} interaction 
 * @param {Object} profile 
 * @param {string} packName 
 */
async function sendPack(client, levels, interaction, profile, packName) {
	const guild = client.guilds.cache.get(GD_VENEZUELA_GUILD_ID);
	if (guild) {
		const channel = await guild.channels.fetch(channels.SUBMITS)
		if (!channel) {
			throw new Error('Channel not found.')
		}

		const embed = new EmbedBuilder()
		embed.setTitle("GD Venezuela List")
		embed.setColor(0x2b2d31)
		embed.setThumbnail(interaction.user.displayAvatarURL({ size: 128, extension: 'png' }))
		embed.setDescription('Solicitud para cargar un usuario a la leaderboard de uno de los packs en **GD Venezuela List**');
		embed.addFields([
			{ name: 'Username', value: profile.username, inline: true },
			{ name: 'User ID', value: profile.userId, inline: true },
			{ name: 'Pack', value: packName, inline: true },
			{ name: '#1', value: levels[0].includes('https://www.youtube.com') ? `[Ver vídeo](${levels[0]})` : `[Ver imagen](${levels[0]})`, inline: true },
			{ name: '#2', value: levels[1].includes('https://www.youtube.com') ? `[Ver vídeo](${levels[1]})` : `[Ver imagen](${levels[0]})`, inline: true },
			{ name: '#3', value: levels[2].includes('https://www.youtube.com') ? `[Ver vídeo](${levels[2]})` : `[Ver imagen](${levels[0]})`, inline: true }
		]);

		await channel.send({ embeds: [embed] })
		await interaction.editReply('Solicitud enviada con éxito. Un modelador de la lista comprobará la información enviada y la aprobará.')
	}
}

/**
 * 
 * @param {Client} client
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(client, database, interaction) {
	try {
		if (interaction.user.id !== '591640548490870805') {
			return await interaction.reply('Comando en mantenimiento.')
		}

		await interaction.deferReply()
		if (await verifyConditionsToContinue(client, interaction)) {
			const messageId = interaction.options.getString('mensaje-id')
			const levels = [
				interaction.options.getString('nivel-1'),
				interaction.options.getString('nivel-2'),
				interaction.options.getString('nivel-3')
			].filter(Boolean)

			const packName = interaction.options.getString('pack')

			const profile = await database.collection(COLL_GDVZLA_LIST_PROFILES).findOne({ userId: interaction.user.id })
			if (!profile) {
				return await interaction.editReply({
					content: 'Tu perfil de usuario en GD Venezuela List no se encontró. Para crear uno, utiliza el comando `/records perfil crear`.',
				})
			}

			if (levels.length === 0 && !messageId) {
				return await interaction.editReply({
					content: 'No ha proporcionado los enlaces de los niveles ni el ID del mensaje para poder continuar.',
					flags: MessageFlags.Ephemeral
				})
			}

			const levelsFound = []

			if (messageId) {
				const dmChannel = interaction.channel ? interaction.channel : await interaction.user.createDM()
				const message = await dmChannel.messages.fetch(messageId)
				if (!message) {
					return await interaction.editReply({
						content: 'No se ha podido encontrar el mensaje con el ID proporcionado.',
					})
				}

				if (message.attachments.size <= 3) {
					for (const attachment of message.attachments.values()) {
						if (typeof attachment?.contentType === 'string' && attachment.contentType.startsWith('image/')) {
							levelsFound.push(attachment.url)
						}
					}
				}
			}

			if (levelsFound.length === 3) {
				return await sendPack(client, levelsFound, interaction, profile, packName)
			}

			for (let i = 0; i < levels.length && levelsFound.length !== 3; i++) {
				if (!utils.isValidYouTubeUrl(levels[i])) {
					return await interaction.editReply({
						content: 'La URL de YouTube no es válida. Compruébalo e inténtalo de nuevo.',
					})
				}

				levelsFound.push(utils.normalizeYoutubeLink(levels[i]))
			}

			if (levelsFound.length === 3)
				return await sendPack(client, levelsFound, interaction, profile, packName)
			return await interaction.editReply({
				content: 'Cantidad de elementos no válidos. Se requieren al menos 3 elementos.',
			})
		}
	} catch (error) {
		logger.ERR(error)
		try {
			await interaction.editReply({
				content: 'Ha ocurrido un error desconocido. Inténtelo más tarde.',
			})
		} catch (err) {
			logger.ERR(err)
		}
	}
}

module.exports = {
	execute
}