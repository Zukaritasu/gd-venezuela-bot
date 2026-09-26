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

const { Message, Guild } = require("discord.js");
const logger = require('../logger');
const utils = require('../utils');

/**
 * A set to keep track of users who are currently being banned.
 * This prevents multiple ban attempts for the same user in a short period of time.
 */
const pendingBans = new Set();

/**
 * Bans a user based on the message content or the replied message.
 * 
 * @param {Guild} guild - The guild where the ban should take place
 * @param {string} reason - The reason for the ban
 * @param {Message} message - The message that triggered the ban command
 * @param {Message} repliedMessage - The message that was replied to, which should contain the embed with the user ID
 * @returns {Promise<void>}
 */
async function banByEmbed(guild, reason, message, repliedMessage) {
	if (!repliedMessage.embeds?.[0]?.fields?.length) {
		return await message.reply('No se pudo encontrar un embed válido en el mensaje respondido.');
	}

	const userId = repliedMessage.embeds[0].fields.find(field => field.name === 'User ID')?.value;
	if (!userId) {
		return await message.reply('No se pudo encontrar el ID de usuario en el embed.');
	}

	try {
		const refMember = { member: null };
		const isMember = await utils.isMember(guild, userId, refMember);
		if (isMember && utils.hasUserPermissions(refMember.member)) {
			return await message.reply('No se puede banear a un miembro del staff.');
		}

		await guild.bans.create(userId, { reason });
		return await message.react('✅');
	} catch (error) {
		logger.ERR(`Failed to ban user with ID ${userId}:`, error);
		try {
			await message.reply(`No se pudo banear al usuario: ${error.message}`);
		} catch {

		}
	}
}

/**
 * Extracts the user ID and reason for the ban from the message content.
 * 
 * @param {string} content - The content of the message.
 * @returns {Object} An object containing the extracted user ID and reason.
 */
function getReasonFromContent(content) {
	const match = content.match(/^--ban\s+(?:<@!?(\d+)>|(\d+))?\s*(.*)/i);

	if (match) {
		const rawId = match[1] || match[2] || null;
		const rawReason = match[3] ? match[3].trim() : '';

		return {
			userId: rawId,
			reason: rawReason || 'No reason provided'
		};
	}

	return {
		userId: null,
		reason: 'No reason provided'
	};
}

/**
 * Bans a user based on the message content or the replied message.
 * 
 * @param {Message} message - The message that triggered the ban command.
 * @returns {Promise<void>}
 */
async function banUser(message) {
	// get replied message
	const guild = message.guild;
	const { userId, reason } = getReasonFromContent(message.content);
	const repliedMessage = message.reference ? await message.channel.messages.fetch(message.reference.messageId) : null;

	if (repliedMessage) {
		const gdveBot = repliedMessage.author;
		if (!gdveBot.bot || gdveBot.id !== process.env.BOT_ID)
			return await message.reply('El mensaje respondido no es un mensaje del bot de GDVE.');
		await banByEmbed(guild, reason, message, repliedMessage);
	} else if (!userId) {
		return await message.reply('No se proporcionó un ID de usuario válido para banear.');
	} else {
		try {
			const refMember = { member: null };
			const isMember = await utils.isMember(guild, userId, refMember);
			if (isMember && utils.hasUserPermissions(refMember.member)) {
				return await message.reply('No se puede banear a un miembro del staff.');
			}

			await guild.bans.create(userId, { reason });
			await message.react('✅');
		} catch (error) {
			logger.ERR(`Failed to ban user with ID ${userId}:`, error);
			try {
				await message.reply(`No se pudo banear al usuario: ${error.message}`);
			} catch {

			}
		}
	}
}

/**
 * Bans a user if they have no roles in the guild, except for the owner.
 * 
 * @param {Guild} guild - The guild where the ban should take place
 * @param {string} userId - The ID of the user to check and potentially ban
 * @returns {Promise<boolean>} - Returns true if the user was banned, false otherwise
 */
async function banUserIfNoRoles(guild, userId) {
	if (userId === process.env.ID_OWNER) return false;
    if (pendingBans.has(userId)) return true; 

	try {
		let member = guild.members.cache.get(userId);
        if (member && member.roles.cache.size > 1)
			return false;

		// Register before fetching to prevent simultaneous bans
		// while obtaining the updated member.
		pendingBans.add(userId);
		member = await guild.members.fetch({ user: userId, force: true }).catch(() => null);
		if (!member || member.roles.cache.size > 1) {
			pendingBans.delete(userId)
			return false
		}

		/* await member.ban({
            reason: 'User has no roles',
            deleteMessageSeconds: 60 * 60 * 24 // Delete messages from the last 24 hours
        }); */

        return true;
	} catch (error) {
		logger.ERR(`Failed to process user @${userId} due to no roles:`, error);
	} finally {
		if (pendingBans.has(userId)) {
			setTimeout(() => pendingBans.delete(userId), 30000);
		}
	}

	return false;
}

module.exports = {
	banUser,
	banUserIfNoRoles
};