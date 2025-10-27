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

const { Message } = require("discord.js");
const { Db } = require("mongodb");
const utils = require('../../utils')
const { COLL_CONFIG } = require('../../../.botconfig/database-info.json')

//////////////////////////////////////////////////

/**
 * @typedef HashInfo
 * @property {string} hash - The SHA256 hash value
 * @property {string} fileUrl - URL of the file associated with the hash
 */

/**
 * @param {Db} db - Database instance
 * @param {HashInfo[]} hashes - Array of SHA256 hashes to save
 * @param {Message} message - Discord message to react to
 */
async function saveHash(db, hashes, message) {
	if (hashes.length === 0)
		return

	const typeName = 'hashes-blacklist';
	const config = await db.collection(COLL_CONFIG).findOne({ type: typeName });
	/** @type {HashInfo[]} */
	const updatedHashes = [...new Set([...(config?.hashes || []), ...hashes])];

	let result
	if (config) {
		result = await db.collection(COLL_CONFIG).updateOne({ type: typeName }, { $set: { hashes: updatedHashes } });
	} else {
		result = await db.collection(COLL_CONFIG).insertOne({
			type: typeName,
			hashes: updatedHashes
		});
	}

	await redisObject.set(typeName, JSON.stringify(updatedHashes));
	await message.react(result.acknowledged ? '✅' : '❌');
}

/**
 * @param {Db} db - Database instance
 * @param {Message} message - Discord message containing the command
 */
async function saveHashes(db, message) {
	const repliedMessageId = message?.reference?.messageId;
	if (!repliedMessageId) return;

	const repliedTo = await message.channel.messages.fetch(message.reference.messageId);
	if (!repliedTo || repliedTo.attachments.size === 0) return;

	const imageAttachments = repliedTo.attachments.filter(att => att.contentType?.startsWith('image/'));
	if (imageAttachments.size === 0)
		return;
	
	const hashes = await Promise.all(
		imageAttachments.map(async att => ({
			hash: await utils.getSHA256(att.url),
			fileUrl: att.url
		}))
	);

	await saveHash(db, hashes, message);
}

module.exports = {
	saveHashes,
	setRedisClientObject: (redisClient) => redisObject = redisClient
};