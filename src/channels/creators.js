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

		if (hasNonMediaAttachment) {
			return await message.delete();
		}

		await message.startThread({
			name: `Hilo de ${message.author.username}`,
			autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek
		})

		await message.react('👍')
		await message.react('👎')
	} catch (error) {
		logger.ERR(error)
	}
}

module.exports = {
	processMessage
}