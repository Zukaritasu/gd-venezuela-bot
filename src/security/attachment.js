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
const path = require('node:path');
//const { GEMINI_API_KEY } = require('../../.botconfig/token.json');

const SUSPICIOUS_RANGE_ATTACHMENTS = { min: 2, max: 4 }
const MAX_USERS_ANALYZE = 5
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

/**
 * Checks if the number of attachments is within the suspicious range
 * 
 * @param {number} count 
 * @returns {boolean}
 */
function hasSuspiciousRange(count) {
	return count >= SUSPICIOUS_RANGE_ATTACHMENTS.min && count <= SUSPICIOUS_RANGE_ATTACHMENTS.max
}

/**
 * @typedef {Object} AttachmentInfo
 * @property {string} url - The URL of the attachment
 * @property {string} filePath - The local file path of the downloaded attachment
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
 * The file is downloaded locally, a random name is assigned to it, and the path to
 * the downloaded file is returned along with its related information.
 * 
 * @param {AttachmentInfo} attachment - The attachment info
 * @param {string} directory - The directory to download the attachment to
 * @returns {Promise<string>} - The path to the downloaded attachment
 */
async function downloadAttachment(attachment, directory) {
	return new Promise((resolve, reject) => {
		const randomName = crypto.randomBytes(16).toString('hex') + '.' + attachment.extension
		const filePath = path.join(directory, randomName)

		exec(`curl -s -o "${filePath}" "${attachment.url}"`, (error, _stdout, _stderr) => {
			if (error) {
				logger.ERR(`Error downloading attachment: ${error.message}`)
				reject(error)
			} else {
				resolve(filePath)
			}
		})
	})
}

/**
 * Checks if any of the downloaded files are malicious
 * 
 * @param {string[]} filePaths - The paths to the downloaded files
 * @returns {Promise<boolean>}
 */
async function hasMaliciousDownloadedFiles(filePaths) {
	return new Promise((resolve, _reject) => {
		logger.DBG(`Checking for malicious files: ${filePaths.join(', ')}`)
		resolve(false)
	})
}

/**
 * Processes an attachment in a message
 * 
 * This function checks if the message contains a suspicious number of attachments,
 * and if so, downloads them and checks for malicious content.
 * 
 * @param {Message} message - The message containing the attachment
 */
async function processAttachment(message) {
	const userId = message.author.id
	if (users.has(userId) || users.size >= MAX_USERS_ANALYZE
		|| !hasSuspiciousRange(message.attachments.size)
		|| !process.env.DIRECTORY_ATTACHMENTS)
		return

	users.add(userId)

	try {
		const currentSize = message.attachments.size
		const attachments = message.attachments.map(att => {
			if (att.contentType &&
				att.contentType.startsWith('image/') && /\.(png|jpe?g)$/i.test(att.name) &&
				att.size < MAX_FILE_SIZE) {
				return {
					url: att.url,
					name: att.name,
					extension: att.name.split('.').pop().toLowerCase()
				}
			}

			return null
		}).filter(Boolean)

		if (attachments.length !== currentSize) {
			const filePaths = (await Promise.all(
				attachments.map(att =>
					downloadAttachment(att, process.env.DIRECTORY_ATTACHMENTS)
						.catch(() => null)))).filter(Boolean)
			if (filePaths.length !== currentSize) {
				await hasMaliciousDownloadedFiles(filePaths)
			}
		}
	} catch (error) {
		logger.ERR(error)
	} finally {
		users.delete(userId)
	}
}

module.exports = {
	processAttachment,
	hasSuspiciousRange,
}