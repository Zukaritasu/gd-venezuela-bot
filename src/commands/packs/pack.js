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

const { Message, Client } = require('discord.js');
const logger = require('../../logger');
const channels = require('../../../.botconfig/channels.json');
const gdvzlalistapi = require('../../gdvzlalistapi');
const { RESTJSONErrorCodes } = require('discord-api-types/v10')

///////////////////////////////////////////////////

const GD_VENEZUELA_GUILD_ID = '1119795689984102455';

/**
 * @typedef {Object} EmbedData
 * @property {string | null} username - username in the GD Venezuela List
 * @property {string | null} userId - Discord user ID
 * @property {string | null} packname - pack name
 */

/**
 * Sends a message to a specific user, attempting a Direct Message (DM) first.
 * If the DM fails due to the user having DMs closed, it sends a message in the designated
 * bot channel, mentioning the user.
 * 
 * @param {Client} client - The Discord client instance.
 * @param {string} userId - The Discord user ID of the recipient.
 * @param {string} messageStr - The message content to send.
 * @returns {Promise<boolean>} - True if the message was successfully delivered (DM or public channel), false otherwise.
 */
async function sendMessage(client, userId, messageStr) {
	const guild = client.guilds.cache.get(GD_VENEZUELA_GUILD_ID)

	try {
		if (guild) {
			const member = await guild.members.fetch(userId).catch(() => null);
			if (member) {
				await member.send(messageStr);
				return true;
			}
		}
	} catch (err) {
		logger.ERR(err)
		try {
			if (err?.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser && guild) {
				const channel = guild.channels.cache.get(channels.BOT)
				if (channel) {
					await channel.send(`<@${userId}> ${messageStr}`)
					return true
				}
			}
		} catch (err2) {
			logger.ERR(err2)
		}
	}

	return false
}

/**
 * Fetches the message that the current message is replying to.
 * It only returns the replied message if it was sent by the bot (based on bot ID).
 * 
 * @param {Message} message - The current message object.
 * @returns {Promise<Message | null>} - The replied Message object if found and sent by the bot, otherwise null.
 */
async function getRepliedMessage(message) {
	if (message.reference?.messageId) {
		const repliedMessage = await message.channel.messages.fetch(message.reference.messageId)
			.catch(err => logger.ERR("Error fetching replied message: " + err));
		if (repliedMessage && repliedMessage.author.id === '1294111960882872341' /* bot id */) {
			return repliedMessage;
		}
	}
	return null;
}

/**
 * Extracts relevant data (username, packname, userId) from the first embed 
 * of the replied message.
 * 
 * @param {Message} repliedMessage - The message to which a reply is made containing the embed.
 * @returns {EmbedData | null} - An object containing the extracted data, or null if no embed is found.
 */
function getEmbedData(repliedMessage) {
	if (repliedMessage.embeds.length > 0) {
		const embed = repliedMessage.embeds[0]
		return {
			username: embed.fields.find(field => field.name === 'Username')?.value,
			packname: embed.fields.find(field => field.name === 'Pack')?.value,
			userId: embed.fields.find(field => field.name === 'User ID')?.value
		}
	}

	return null
}

/**
 * Handles the acceptance of a user's request to join a pack leaderboard.
 * 1. Fetches the pack file and checks if the pack exists.
 * 2. Fetches the pack's current leaderboard.
 * 3. Checks if the user is already on the leaderboard.
 * 4. Adds the new user to the leaderboard content and saves the file via API.
 * 5. Notifies the user of acceptance via DM (or bot channel mention).
 * 6. Adds reactions (✅/📧) to the original and reply messages.
 * 
 * @param {Message} message - The moderation message (the one running the command/function).
 * @param {Message} repliedMessage - The message containing the embed request.
 * @param {EmbedData} embedData - The extracted data from the embed (username, packname, userId).
 * @returns {Promise<void>}
 */
async function saveUsernameToLeaderboard(message, repliedMessage, embedData) {
	const packFile = await gdvzlalistapi.getPacksFile()
	const pack = packFile.content.find(pack => pack.name === embedData.packname)
	if (!pack)
		return await message.reply(`No se encontró el pack ${embedData.packname}.`);
	const fileId = pack.id

	const fileLeaderboard = await gdvzlalistapi.getPackFileLeaderboard(fileId)
	if (fileLeaderboard.content.find(record => record.user === embedData.username)) {
		return await message.reply('El usuario ya existe en el leaderboard')
	}

	fileLeaderboard.content.push(
		{
			user: embedData.username
		}
	)

	await gdvzlalistapi.savePackFileLeaderboard(fileLeaderboard, fileId, message.author)

	const isDmClosed = await sendMessage(message.client, embedData.userId, `Has sido aceptado en la clasificación del pack **${embedData.packname}**`)

	await repliedMessage.react('✅')
	if (!isDmClosed)
		await message.react('📧')
	await message.react('✅')
}

/**
 * Primary function to manage the acceptance or rejection of a leaderboard request.
 * It coordinates fetching the replied message, extracting embed data, and calling 
 * the appropriate action function (`saveUsernameToLeaderboard` or sending a rejection message).
 * 
 * @param {Message} message - The moderation message.
 * @param {boolean} condition - True for acceptance, false for rejection.
 * @returns {Promise<void>}
 */
async function handlePack(message, condition) {
	try {
		const repliedMessage = await getRepliedMessage(message)
		if (!repliedMessage) {
			return await message.reply('Has respondido a un mensaje no válido o inexistente.')
		}

		const embedData = getEmbedData(repliedMessage)
		if (!embedData || !embedData.packname || !embedData.userId || !embedData.username) {
			return await message.reply(`Embed no válido`)
		}

		// true - The request to enter the leaderboard for the
		// specified pack is accepted.
		if (condition) {
			return await saveUsernameToLeaderboard(message, repliedMessage, embedData)
		} else {
			const content = message.content.substring('--rechazar'.length).trim()
			let isDmClosed = await sendMessage(message.client, embedData.userId, 
				`Tu solicitud ha sido rechazada para entrar en la clasificacion del pack **${embedData.packname}**.\n` +
				`Razón: ${content.length === 0 ? '*el moderador no especificó una razón.*' : content}`)
			
			await repliedMessage.react('❌')

			if (!isDmClosed) 
				await message.react('📧')
			await message.react('✅')
		}
	} catch (error) {
		logger.ERR(error)
		try {
			await message.reply(`Ha ocurrido un error desconocido. ${error.message}`)
		} catch {

		}
	}
}

/**
 * Command handler function for accepting a pack leaderboard request.
 * Calls handlePack with condition = true.
 * 
 * @param {Message} message - The message object that triggered the command.
 * @returns {Promise<void>}
 */
async function accept(message) {
	await handlePack(message, true);
}

/**
 * Command handler function for declining a pack leaderboard request.
 * Calls handlePack with condition = false.
 * 
 * @param {Message} message - The message object that triggered the command.
 * @returns {Promise<void>}
 */
async function decline(message) {
	await handlePack(message, false);
}

module.exports = {
	accept,
	decline
}