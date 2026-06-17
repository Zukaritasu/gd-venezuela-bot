/**
 * Copyright (C) 2026 Zukaritasu
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

const logger = require('../logger');
const robtopapi = require('../robtopapi');
const { TOP_CREATOR_POINTS } = require('../../.botconfig/channels.json');
const { COLL_CREATOR_POINT_PLAYERS, COLL_CONFIG } = require('../../.botconfig/database-info.json');
const { Client, Message } = require('discord.js');
const { Db } = require('mongodb');

const TIME_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
const MAX_ENTRIES = 10;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch the leaderboard data from the database.
 * @param {Db} db - The database instance
 * @returns {Promise<Array<{ creatorPoints: number, username: string }>>}
 * An array of leaderboard entries
 */
async function fetchLeaderboardData(db) {
	const accounts = await db.collection(COLL_CREATOR_POINT_PLAYERS).find({}, { projection: { accountID: 1 } }).toArray();
	/** @type {Array<{ creatorPoints: number, username: string }>} */
	let proccessedData = []

	for (const account of accounts) {
		try {
			const userInfo = await robtopapi.getUserInfo(account.accountID);
			if (userInfo) {
				logger.DBG(`Fetched user info for account ID ${account.accountID}: ${userInfo.get('userName')}, Creator Points: ${userInfo.get('creatorpoints')}`); // Debug log for successful API calls
				proccessedData.push({
					creatorPoints: parseInt(userInfo.get('creatorpoints') || '0', 10),
					username: userInfo.get('userName') || ''
				});
			} else {
				logger.DBG(`Failed to fetch user info for account ID ${account.accountID}`); // Debug log for failed API calls
			}
		} catch (error) {
			logger.ERR(`Error fetching user info for account ID ${account.accountID}:`, error);
		}

		await sleep(2000); // Sleep for 2 seconds to avoid hitting rate limits
	}

	proccessedData = proccessedData.filter(userInfo => {
		return userInfo.username && userInfo.creatorPoints > 0;
	}).sort((a, b) => b.creatorPoints - a.creatorPoints);

	return proccessedData;
}

async function isListUpdatable(db) {
	const now = new Date();
	const doc = await db.collection(COLL_CONFIG).findOne({ type: 'lastCreatorPointsUpdates' });

	if (!doc) {
		await db.collection(COLL_CONFIG).insertOne({
			type: 'lastCreatorPointsUpdates',
			timeLastUpdate: now
		});
		return true;
	}

	const lastUpdate = doc.timeLastUpdate ? new Date(doc.timeLastUpdate) : null;

	if (!lastUpdate || (now - lastUpdate) >= TIME_INTERVAL) {
		await db.collection(COLL_CONFIG).updateOne(
			{ type: 'lastCreatorPointsUpdates' },
			{ $set: { timeLastUpdate: now } }
		);
		return true;
	}

	return false;
}

/**
 * Fetch the existing leaderboard message from the channel, if it exists.
 * @param {Db} db - The database instance
 * @param {TextChannel} channel - The Discord text channel to fetch the message from
 * @returns {Promise<Message|null>} The existing leaderboard message, or null if not found
 */
async function getMessageLeaderboard(db, channel) {
	const messageId = await db.collection(COLL_CONFIG).findOne({ type: 'leaderboardCreatorPointsMessageId' });
	if (messageId && messageId.value) {
		try {
			const message = await channel.messages.fetch(messageId.value);
			return message;
		} catch (error) {
			logger.ERR('Failed to fetch existing leaderboard message:', error);
			return null;
		}
	}

	return null;
}

/**
 * Save the ID of the leaderboard message to the database for future reference.
 * @param {Db} db - The database instance
 * @param {string} messageId - The ID of the message to save
 * @returns {Promise<void>}
 */
async function saveLeaderboardMessageId(db, messageId) {
	await db.collection(COLL_CONFIG).updateOne(
		{ type: 'leaderboardCreatorPointsMessageId' },
		{ $set: { value: messageId } },
		{ upsert: true }
	);
}

/**
 * Get the appropriate icon prefix based on the position in the leaderboard.
 * @param {number} pos - The position in the leaderboard (0-based index)
 * @returns {string} The icon prefix for the given position
 */
function getIconPrefix(pos) {
	switch (pos) {
		case 0:
			return '<:CRP_oro:1513672271099854950>';
		case 1:
			return '<:CRP_plata:1513672267635228772>';
		case 2:
			return '<:CRP_bronce:1513672269480857731>';
	}

	return '<:CRP:1513672272895017000>';
}

/**
 * Format a sorted list of creator point entries into a leaderboard string.
 * Only the top 10 score groups are returned.
 *
 * @param {Array<{ creatorPoints: number, username: string }>} entries
 * @returns {string}
 */
function formatTopCreatorPoints(entries) {
	if (!Array.isArray(entries) || entries.length === 0) {
		return '';
	}

	const groups = [];
	let currentPoint = null;
	let currentUsers = [];

	for (const entry of entries) {
		if (currentPoint === null || entry.creatorPoints !== currentPoint) {
			if (currentPoint !== null) {
				groups.push({
					creatorPoints: currentPoint,
					usernames: currentUsers
				});
			}

			currentPoint = entry.creatorPoints;
			currentUsers = [entry.username];
		} else {
			currentUsers.push(entry.username);
		}
	}

	if (currentPoint !== null) {
		groups.push({
			creatorPoints: currentPoint,
			usernames: currentUsers
		});
	}

	return groups.slice(0, MAX_ENTRIES)
		.map((group, index) => `${index + 1}. ${getIconPrefix(index)} **${group.usernames.join(' / ')}** - ${group.creatorPoints}`)
		.join('\n');
}

/**
 * Get the top 10 creator points from the database and format it as a string.
 * 
 * @param {*} db 
 * @returns {Promise<string | null>} The top 10 creator points as a formatted string,
 * or null if an error occurs
 */
async function getTopCreatorPoints(db) {
	const data = await fetchLeaderboardData(db);
	return formatTopCreatorPoints(data);
}

/**
 * @param {Db} db 
 * @param {Client} client 
 */
async function service(db, client) {
	const functionRun = async () => {
		try {
			if (await isListUpdatable(db)) {
				const guild = client.guilds.cache.get(process.env.SERVER_GD_VENEZUELA_ID)
				if (!guild) return;

				/** @type {import('discord.js').TextChannel} */
				const channel = await guild.channels.fetch(TOP_CREATOR_POINTS);
				if (!channel) return;

				const message = await getMessageLeaderboard(db, channel);

				const topCreatorPoints = await getTopCreatorPoints(db);
				const description = '\nEste es el TOP 10 usuarios con mas Creator Points en el país. Un reconocimiento a los usuarios con más Creator Points que, con su dedicación, decoración y gameplay, representan a nuestro país en la comunidad global de Geometry Dash.\n\n';

				if (topCreatorPoints) {
					const content = '## **TOP 10 CREATOR POINTS**\n' + description + topCreatorPoints +
						'\n\n-# Ultima actualización: ' + new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' });

					if (message) {
						await message.edit({ content });
					} else {
						const newMessage = await channel.send({ content });
						await saveLeaderboardMessageId(db, newMessage.id);
					}
				}
			}
		} catch (error) {
			logger.ERR(error);
		}
	}

	await functionRun();

	const timeout = setInterval(functionRun, /* 10 hours */ 10 * 60 * 60 * 1000);

	return {
		stop: () => clearInterval(timeout),

		description: 'Automatic update service for the TOP 10 Creator Point leaderboard',
		name: 'service-leaderboard-creator-point',
		fullname: 'Leaderboard Creator Point Service'
	}
}

module.exports = {
    start: service,
    formatTopCreatorPoints
}