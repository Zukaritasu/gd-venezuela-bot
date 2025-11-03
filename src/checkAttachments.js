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

const { Message, EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const logger = require('./logger')
const utils = require('./utils')
const { Db } = require("mongodb");
const channels = require('../.botconfig/channels.json')
const { COLL_CONFIG } = require('../.botconfig/database-info.json')
const { HASTEBIN_TOKEN } = require('../.botconfig/token.json');

//////////////////////////////////////////////////

/** @type {import('redis').RedisClientType} */
let redisObject = null

/**
 * @typedef HashInfo
 * @property {string} hash - The SHA256 hash value
 * @property {string} fileUrl - URL of the file associated with the hash
 */

/**
 * 
 * @param {Db} db 
 * @returns {Promise<HashInfo[]>}
 */
async function getHashes(db) {
	const typeName = 'hashes-blacklist';
	const cached = await redisObject.get(typeName);

	if (cached) {
		return JSON.parse(cached);
	}

	const config = await db.collection(COLL_CONFIG).findOne({ type: typeName });

	if (config) {
		await redisObject.set(typeName, JSON.stringify(config.hashes));
		return config.hashes;
	} else {
		await db.collection(COLL_CONFIG).insertOne({
			type: typeName,
			hashes: []
		});
		return [];
	}
}

/**
 * 
 * @param {string} hashValue 
 * @returns {Promise<string|null>}
 */
async function uploadToHastebin(hashValue) {
    try {
        const response = await fetch('https://hastebin.com/documents', {
            method: 'POST',
            body: hashValue,
            headers: {
                'Content-Type': 'text/plain',
                'Authorization': `Bearer ${HASTEBIN_TOKEN}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            return `https://hastebin.com/share/${data.key}`;
        }
        return null;
    } catch (error) {
        logger.ERR(error);
        return null;
    }
}

/**
 * @param {Message} message 
 * @param {HashInfo} hashInfo
 */
async function reportHackedUser(message, hashInfo) {
    const guild = message.guild;
    const userId = message.author.id;
    const unbanTimeMs = 5 * 60 * 1000; // 5 minutes
	const joinedAt = message.member.joinedAt;

    await guild.members.ban(userId, {
        reason: 'User with compromised account has sent content identified as fraudulent',
        deleteMessageSeconds: 3600
    });

    setTimeout(async () => {
        try {
            await guild.members.unban(userId, 'Temporary ban for compromised account');
        } catch (error) {
            logger.ERR(error);
        }
    }, unbanTimeMs);

    const hastebinUrlPromise = uploadToHastebin(hashInfo.hash);
    
    const channel = guild.channels.cache.get(channels.MODERATION);
    if (!channel) {
        logger.ERR(`Report channel ${channels.MODERATION} not found.`);
        return; 
    }

    const hastebinUrl = await hastebinUrlPromise;

    await channel.send({
        embeds: [
            new EmbedBuilder()
                .setTitle('User Banned (Compromised Account)')
                .setDescription(`El usuario ha sido baneado por enviar un archivo adjunto con un hash conocido. Este baneo es temporal y se levantará después de ${unbanTimeMs / 60000} minutos.`)
                .setColor(0x2b2d31)
				.setThumbnail(message.author.displayAvatarURL({ size: 128, extension: 'png' }))
                .setFields(
					{ name: 'Username', value: `${message.author.tag}`, inline: true },
                    { name: 'User ID', value: userId, inline: true },
                    { name: 'Joined Discord', value: utils.formatDateTime(message.author.createdAt), inline: true },
                    { name: 'Joined Server', value: utils.formatDateTime(joinedAt), inline: true }
                )
        ],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('View Attachment')
                    .setStyle(ButtonStyle.Link)
                    .setURL(hashInfo.fileUrl),
                new ButtonBuilder()
                    .setLabel(hastebinUrl ? 'View Hash Info' : 'Hastebin Failed')
                    .setStyle(ButtonStyle.Link)
                    .setURL(hastebinUrl || 'https://hastebin.com/') 
            )
        ]
    });
}

/**
 * @param {Db} db
 * @param {Message} message 
 */
async function check(db, message) {
	try {
		if (message.attachments.size === 0) return

		const hashes = await getHashes(db);
		if (hashes.length === 0) return;

		for (const attachment of message.attachments.values()) {
			if (typeof attachment?.contentType === 'string' && attachment.contentType.startsWith('image/')) {
				const hash = await utils.getSHA256(attachment.url);
				const hashInfo = hashes.find(h => h.hash === hash);
				if (hashInfo) {
					return await reportHackedUser(message, hashInfo);
				}
			}
		}
	} catch (error) {
		logger.ERR(error)
	}
}

module.exports = {
	check,
	setRedisClientObject: (redisClient) => redisObject = redisClient
}