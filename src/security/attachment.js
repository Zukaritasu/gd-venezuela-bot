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

const { Message } = require("discord.js");
const logger = require('../logger')
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require("node:path");

const SUSPICIOUS_COUNT_ATTACHMENTS = 4

/**
 * @typedef {Object} AttachmentInfo
 * @property {string} url - The URL of the attachment
 * @property {string} name - The name of the attachment
 * @property {string} extension - The file extension of the attachment
 */

/**
 * A set of user IDs who have uploaded suspicious attachments
 * 
 * @type {Set<string>}
 */
const users = new Set()

/**
 * Downloads an attachment from a URL to a local directory
 * 
 * @param {AttachmentInfo} attachment - The attachment info
 * @param {string} directory - The directory to download the attachment to
 * @returns {Promise<void>}
 */
async function downloadAttachment(attachment, directory) {
	return new Promise((resolve, reject) => {
		const randomName = crypto.randomBytes(16).toString('hex') + '.' + attachment.extension
		const filePath = path.join(directory, randomName)

		exec(`curl -s -o "${filePath}" "${attachment.url}"`, (error, stdout, stderr) => {
			if (error) {
				reject(error)
			} else {
				resolve()
			}
		})
	})
}

/**
 * Processes an attachment in a message
 * 
 * @param {Message} message - The message containing the attachment
 */
async function processAttachment(message) {
	const userId = message.author.id
	if (users.has(userId)
		|| message.attachments.size !== SUSPICIOUS_COUNT_ATTACHMENTS
		|| !process.env.DIRECTORY_ATTACHMENTS)
		return

	users.add(userId)

	try {
		const attachments = message.attachments.map(att => {
			if (att.contentType && att.contentType.startsWith('image/') && /(png|jpe?g)$/i.test(att.name)) {
				return {
					url: att.url,
					name: att.name,
					extension: att.name.split('.').pop().toLowerCase()
				}
			}

			return null
		}).filter(Boolean)

		if (attachments.length === SUSPICIOUS_COUNT_ATTACHMENTS) {
			await Promise.all(attachments.map(att => downloadAttachment(att, process.env.DIRECTORY_ATTACHMENTS)))
		}
	} catch (error) {
		logger.ERR(error)
	} finally {
		users.delete(userId)
	}
}

module.exports = {
	processAttachment,
	SUSPICIOUS_COUNT_ATTACHMENTS
}