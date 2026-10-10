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
const { spawn } = require('child_process');
const path = require('node:path');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const { GEMINI_API_KEY } = require('../../.botconfig/token.json');

const SUSPICIOUS_RANGE_ATTACHMENTS = { min: 2, max: 4 }
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

class Mutex {
	constructor() {
		this.tail = Promise.resolve();
	}

	async acquire() {
		let release;
		const nextTail = new Promise((resolve) => {
			release = resolve;
		});
		const currentTail = this.tail;
		this.tail = nextTail;

		await currentTail;
		return release;
	}
}

const mutex = new Mutex();

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
 * @property {string} extension - The file extension of the attachment
 */

/**
 * @typedef {Object} DownloadedAttachment
 * @property {string} file - The path to the downloaded file
 * @property {string} hash - The SHA256 hash of the downloaded file
 * @property {boolean} malicious - Whether the file is malicious
 */

/**
 * Executes moderation actions for a message with malicious attachments
 * 
 * @param {Message} message - The message containing the malicious attachments
 * @param {string} userId - The ID of the user who sent the message
 * @returns {Promise<boolean>} - Returns true if moderation actions were
 * executed successfully, false otherwise
 */
async function executeModeration(_message, userId) {
	logger.INF(`Executing moderation for user ${userId} due to malicious attachments.`)
	// test
	return false;
}

/**
 * Computes the SHA256 hash of a file
 *		
 * @param {string} filePath - The path to the file
 * @returns {Promise<string>} - The SHA256 hash of the file in hexadecimal format
 */
async function getSHA256(filePath) {
    const hash = crypto.createHash('sha256');

    const readStream = fs.createReadStream(filePath, { 
        highWaterMark: 64 * 1024 
    });

    await pipeline(readStream, hash);

    return hash.digest('hex');
}

/**
 * Downloads an attachment from a URL to a local directory
 * 
 * The file is downloaded locally, a random name is assigned to it, and the path to
 * the downloaded file is returned along with its related information.
 * 
 * @param {AttachmentInfo} attachment - The attachment info
 * @param {string} directory - The directory to download the attachment to
 * @returns {Promise<DownloadedAttachment | null>} - The downloaded attachment
 * information or null if the download failed
 */
async function downloadAttachment(attachment, directory) {
	const release = await mutex.acquire();

	try {
		const randomName = crypto.randomBytes(16).toString('hex') + '.' + attachment.extension
		const filePath = path.join(directory, randomName)

		const response = await fetch(attachment.url)

		if (!response.ok) 
			throw new Error(`Failed to fetch attachment: ${response.status} ${response.statusText}`)
		if (!response.body) 
			throw new Error('Attachment response has no body')

		// Use pipeline to stream the response body to a file
		// This is more memory efficient than reading the entire response into memory
		await pipeline(response.body, fs.createWriteStream(filePath))

		const fileHash = await getSHA256(filePath)
		const maliciusFilePath = path.join(directory, `${fileHash}.malicious`)

		if (fs.existsSync(maliciusFilePath)) {
			// If the file is already marked as malicious, return its info
			return { file: filePath, hash: fileHash, malicious: true }
		}

		const sha256FilePath = path.join(process.env.DIRECTORY_ATTACHMENTS, `${fileHash}.sha256`)
		if (!fs.existsSync(sha256FilePath)) {
			await fs.promises.writeFile(sha256FilePath, fileHash)
		}

		return { file: filePath, hash: fileHash, malicious: false }
	} catch (error) {
		logger.ERR(error)
		await fs.promises.unlink(filePath).catch(() => {})
	} finally {
		release()
	}

	return null
}

/**
 * Checks if any of the downloaded files are malicious
 * 
 * @param {string[]} filePaths - The paths to the downloaded files
 * 
 * @returns {Promise<boolean | Error>} - Returns true if any file is malicious,
 * false otherwise, or an Error if the gscan command fails
 */
async function hasMaliciousDownloadedFiles(filePaths) {
	return new Promise((resolve, _reject) => {
		const childProcess = spawn(`${process.env.DIRECTORY_ATTACHMENTS}/gscan`, filePaths);

		childProcess.stdin.write(`${GEMINI_API_KEY}\n`);
		childProcess.stdin.end();

		let stdout = '';

		childProcess.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		childProcess.on('close', (code) => {
			if (code !== 0) {
				resolve(new Error(`gscan exited with code ${code}`));
			} else if (!/^\d+$/.test(stdout)) {
				resolve(new Error(`Unexpected output from gscan: ${stdout}`));
			} else {
				const maliciousCount = parseInt(stdout, 10);
				resolve(maliciousCount > 70 && maliciousCount <= 100);
			}
		});

		childProcess.on('error', (error) => {
			resolve(new Error(`Error executing gscan: ${error.message}`));
		});
	})
}

/**
 * Processes an attachment in a message
 * 
 * This function checks if the message contains a suspicious number of attachments,
 * and if so, downloads them and checks for malicious content.
 * 
 * @param {Message} message - The message containing the attachment
 * @returns {Promise<boolean>} - Returns true if the attachment was malicious, false otherwise
 */
async function processAttachment(message) {
	const userId = message.author.id

	if (!process.env.DIRECTORY_ATTACHMENTS)
		return false

	let filePaths = null

	try {
		// Parse attachments and filter for valid image files
		const attachments = message.attachments.map(att => {
			if (att.contentType &&
				att.contentType.startsWith('image/') && /\.(png|jpe?g)$/i.test(att.name) &&
				att.size < MAX_FILE_SIZE) {
				return {
					url: att.url,
					extension: att.name.split('.').pop().toLowerCase()
				}
			}

			return null
		}).filter(Boolean)

		// Check if the number of attachments matches the message's attachment size
		if (attachments.length !== message.attachments.size)
			return false

		filePaths = await Promise.all(attachments.map(att =>
			downloadAttachment(att, process.env.DIRECTORY_ATTACHMENTS)))
		if (filePaths.some(fp => fp === null)) {
			return false
		}

		const malicious = await hasMaliciousDownloadedFiles(filePaths.map(fp => fp.file))

		if (malicious instanceof Error) {
			// Log the error and return false
			logger.ERR(malicious)
		} else if (malicious) {
			filePaths.forEach(fp => {
				const maliciousFilePath = path.join(process.env.DIRECTORY_ATTACHMENTS, `${fp.hash}.malicious`)
				fs.promises.writeFile(maliciousFilePath, fp.hash).catch(() => { })
			})

			return await executeModeration(message, userId)
		}
	} catch (error) {
		logger.ERR(error)
	} finally {
		if (filePaths) {
			await Promise.all(filePaths.map(fp => {
				if (fp && fp.file) {
					return fs.promises.unlink(fp.file).catch(() => { })
				}
			}))
		}
	}

	return false
}

module.exports = {
	processAttachment,
	hasSuspiciousRange,
}