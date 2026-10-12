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

const { Message, ThreadAutoArchiveDuration } = require("discord.js");
const logger = require('../logger')
const { COLL_THREADS_CREATIONS } = require('../../.botconfig/database-info.json')

/**
 * Records a creator's message in the creations collection.
 *
 * Stores the user ID, message ID, and the time the record was created. Any
 * database errors are logged and suppressed.
 *
 * @param {string} userId - The ID of the user who created the message.
 * @param {string} messageId - The ID of the message to record.
 * @returns {Promise<void>} A promise that resolves after the insert attempt.
 */
async function logMessage(userId, messageId) {
	try {
		await global.database.collection(COLL_THREADS_CREATIONS).insertOne(
			{
				userId,
				messageId,
				createdAt: new Date()
			}
		)
	} catch (error) {
		logger.ERR(error)
	}
}

/**
 * Handles a message sent in a creators channel.
 * 
 * If the message has no attachments or contains non-media files, it is deleted.
 * Otherwise, a thread is created for the message and approval/disapproval reactions
 * are added to it.
 *
 * @param {Message} message - The Discord message to process.
 * @returns {Promise<void>} A promise that resolves when the message has been handled.
 */
async function processMessage(message) {
	try {
		const attSize = message.attachments.size
		if (attSize === 0) {
			return await message.delete()
		}

		const hasNonMediaAttachment = message.attachments.some(attachment => {
			const contentType = attachment.contentType || '';
			const extension = attachment.name?.split('.').pop()?.toLowerCase();
			const mediaExtensions = [
				'png', 'jpg', 'jpeg',
				'mp4', 'mkv', 'mov', 'webm', 'avi', 'mpeg', 'mpg'
			];
			return !contentType.startsWith('image/') && !contentType.startsWith('video/') &&
				!mediaExtensions.includes(extension);
		});

		if (hasNonMediaAttachment && 
			!/(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[^\s]+/i.test(message.content)) {
			return await message.delete();
		}

		await message.startThread({
			name: `Hilo de ${message.author.username}`,
			autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek
		})

		await message.react('👍')
		await message.react('👎')

		await logMessage(message.author.id, message.id)
	} catch (error) {
		logger.ERR(error)
	}
}

module.exports = {
	processMessage
}