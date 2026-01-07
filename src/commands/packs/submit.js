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
const gdvzlalistapi = require('../../gdvzlalistapi');
const { COLL_GDVZLA_LIST_PROFILES } = require('../../../.botconfig/database-info.json')
const { Db } = require('mongodb')


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

	const guild = client.guilds.cache.get(process.env.SERVER_GD_VENEZUELA_ID);
	if (guild) {
		try {
			const member = await guild.members.fetch(interaction.user.id);
			if (!member) {
				return await interaction.editReply({
					content: 'No se pudo verificar tu membresía. Asegúrate de estar en el servidor de GD Venezuela'
				});
			}

			if (member.roles.cache.has(process.env.ID_ROL_VENEZOLANO))
				return true
			await interaction.editReply({
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
	const guild = client.guilds.cache.get(process.env.SERVER_GD_VENEZUELA_ID);
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
			{ name: '#2', value: levels[1].includes('https://www.youtube.com') ? `[Ver vídeo](${levels[1]})` : `[Ver imagen](${levels[1]})`, inline: true },
			{ name: '#3', value: levels[2].includes('https://www.youtube.com') ? `[Ver vídeo](${levels[2]})` : `[Ver imagen](${levels[2]})`, inline: true }
		]);

		await channel.send({ embeds: [embed] })
		await interaction.editReply('Solicitud enviada con éxito. Un modelador de la lista comprobará la información enviada y la aprobará.')
	}
}

/**
 * Locates a specific pack by its name, retrieves its Leaderboard (ranking table), 
 * and adds the given profile's username to the ranking if it does not already exist.
 * Responds to the Discord interaction** with a success or error message 
 * (pack not found or user already exists).
 *
 * @param {ChatInputCommandInteraction} interaction The Discord interaction object.
 * @param {string} packname The name of the pack whose leaderboard needs to be updated.
 * @param {Object} profile An object containing user data, **must include the `username` property**.
 * @returns {Promise<void>} A Promise that resolves when the reply has been edited
 */
async function saveUsernameToLeaderboard(interaction, packname, profile) {
	const packFile = await gdvzlalistapi.getPacksFile()
	const pack = packFile.content.find(pack => pack.name === packname)
	if (!pack)
		return await interaction.editReply(`No se encontró el pack **${packname}**.`);
	const fileId = pack.id

	const fileLeaderboard = await gdvzlalistapi.getPackFileLeaderboard(fileId)
	if (fileLeaderboard.content.find(record => record.user === profile.username)) {
		await interaction.editReply(`Ya existes en el leaderboard del pack **${packname}**`)
	} else {
		fileLeaderboard.content.push(
			{
				user: profile.username
			}
		)

		await gdvzlalistapi.savePackFileLeaderboard(
			fileLeaderboard, 
			fileId, 
			interaction.user.username
		)

		await interaction.editReply(`Listo! Ya eres parte de la clasificación en el pack **${packname}**`)
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
		await interaction.deferReply()
		if (await verifyConditionsToContinue(client, interaction)) {
			const messageId = interaction.options.getString('mensaje-id')
			const levels = [
				interaction.options.getString('nivel-1'),
				interaction.options.getString('nivel-2'),
				interaction.options.getString('nivel-3')
			].filter(Boolean)

			const packName = interaction.options.getString('pack')
			const packNameLowerCase = packName.toLowerCase()

			const profile = await database.collection(COLL_GDVZLA_LIST_PROFILES).findOne({ userId: interaction.user.id })
			if (!profile) {
				return await interaction.editReply({
					content: 'Tu perfil de usuario en GD Venezuela List no se encontró. Para crear uno, utiliza el comando `/records perfil crear`.',
				})
			}

			// If the user already has the role assigned to the requested package,
			// they do not need to send proof of their levels; they will be approved directly.
			const member = await client.guilds.cache.get(process.env.SERVER_GD_VENEZUELA_ID)
				.members.fetch(interaction.user.id)
			if (!member) {
				return await interaction.editReply({
					content: 'No se pudo verificar tu membresía. Asegúrate de estar en el servidor de GD Venezuela'
				});
			} else if (member.roles.cache.find(role => role.name.toLowerCase() === packNameLowerCase)) {
				// TODO: A comparison is made between the package name on the website
				// and the role name on the Discord server.
				return await saveUsernameToLeaderboard(interaction, packName, profile)
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
				const messageIdFormated = messageId.includes('discord.com/channels') ? messageId.split('/').pop() : messageId
				if (messageIdFormated.length < 18 || isNaN(messageIdFormated))
					return await interaction.editReply({
						content: 'La URL no terminó en un ID de mensaje válido',
					}) 
				
				const message = await dmChannel.messages.fetch(messageIdFormated)
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