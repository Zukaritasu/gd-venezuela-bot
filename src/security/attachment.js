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

const { Message, Collection, Attachment } = require("discord.js");
const logger = require('../logger')
const token = require('../../.botconfig/token.json')
const crypto = require('crypto');
const fs = require('node:fs')
const { exec } = require('child_process');
const path = require("node:path");

/**
 * @type {Set<string>}
 */
const users = new Set()

/**
 * 
 * @param {Message} message
 */
async function processAttachment(message) {
	const userId = message.author.id
	if (users.has(userId) || message.attachments.size !== 4)
		return

	users.add(userId)

	try {
		for (const attachment of message.attachments.values()) {
			// Printt all the attachment details to the console
			logger.DBG(`Attachment details: ${JSON.stringify(attachment)}`);
		}
	} catch (error) {
		logger.ERR(error)
	} finally {
		users.delete(userId)
	}
}

module.exports = {
	processAttachment
}