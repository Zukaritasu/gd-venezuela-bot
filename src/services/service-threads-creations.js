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

const { COLL_CONFIG, COLL_THREADS_CREATIONS } = require('../../.botconfig/database-info.json')
const channels = require('../../.botconfig/channels.json')
const logger = require('../logger');
const { TextChannel } = require('discord.js');
const { EmbedBuilder } = require('discord.js');

const REPORT_INTERVAL = 14 * 24 * 60 * 60 * 1000;

/**
 * A database record linking a creator to a message posted in the creations channel.
 *
 * @typedef {Object} UserThreads
 * @property {string} userId - ID of the user who posted the message.
 * @property {string} messageId - ID of the Discord message.
 * @property {Date} createdAt - Date and time when the record was created.
 */

/**
 * Reaction counts and identity data for a user's top-rated creation.
 *
 * @typedef {Object} Reaction
 * @property {number} like - Number of thumbs-up reactions on the creation.
 * @property {number} dislike - Number of thumbs-down reactions on the creation.
 * @property {string} userId - Discord ID of the creator.
 * @property {string} username - Discord tag of the creator.
 */

/**
 * Fetches the messages referenced by creation records and returns the top
 * creation for each user, ordered by thumbs-up count.
 *
 * @param {UserThreads[]} logs - Creation records to inspect.
 * @returns {Promise<Reaction[] | null>} The ten highest-rated user creations,
 *   or null if an error occurs while fetching the channel or reactions.
 */
async function getAllReactions(logs) {
	try {
		/**@type {TextChannel} */
		const channel = await global.guild.channels.fetch(channels.CREACIONES)
		if (!channel) throw new Error(`Channel ${channels.CREACIONES} not found`);

		/**@type {Map<string, Reaction>} */
		const reactions = new Map()
		for (const log of logs) {
			const message = await channel.messages.fetch(log.messageId).catch(() => null)
			if (message) {
				const member = global.guild.members.cache.get(log.userId) ??
					await global.guild.members.fetch(log.userId).catch(() => null)
				if (member) {
					const reaction = {
						like: message.reactions.cache.get('👍')?.count ?? 0,
						dislike: message.reactions.cache.get('👎')?.count ?? 0,
						userId: log.userId,
						username: member.user.tag
					}

					if (reaction.like > (reactions.get(log.userId)?.like ?? 0)) {
						reactions.set(log.userId, reaction)
					}
				}
			}
		}

		return [...reactions.values()].sort((a, b) => b.like - a.like).slice(0, 10)
	} catch (error) {
		logger.ERR(error)
	}

	return null
}

/**
 * Checks whether the configured reporting interval has elapsed and records
 * the current time when a report becomes due.
 *
 * @returns {Promise<boolean>} True if a report is due; otherwise, false.
 */
async function isReportable() {
	const now = new Date();
	const collConfig = global.database.collection(COLL_CONFIG)
	const doc = await collConfig.findOne({ type: 'lastReportThreadsCreations' });

	if (!doc) {
		await collConfig.insertOne({
			type: 'lastReportThreadsCreations',
			timeLastUpdate: now
		});
		return true;
	}

	const lastUpdate = doc.timeLastUpdate ? new Date(doc.timeLastUpdate) : null;

	if (!lastUpdate || (now - lastUpdate) >= REPORT_INTERVAL) {
		await collConfig.updateOne(
			{ type: 'lastReportThreadsCreations' },
			{ $set: { timeLastUpdate: now } }
		);
		return true;
	}

	return false;
}

/**
 * Builds and sends the periodic report of users' creation reactions to the
 * moderation channel.
 *
 * Errors encountered while checking eligibility, fetching data, or sending
 * the report are logged and suppressed.
 *
 * @returns {Promise<void>} A promise that resolves after the report attempt.
 */
async function createReport() {
	try {
		if (await isReportable()) {
			const twoWeeksAgo = new Date();
			twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

			const logs = await global.database.collection(COLL_THREADS_CREATIONS).find({
				createdAt: { $gte: twoWeeksAgo }
			}).toArray()

			if (logs.length === 0) return

			const allReactions = await getAllReactions(logs)
			if (!allReactions || allReactions.length === 0)
				return

			/**@type {TextChannel} */
			const channelMod = await global.guild.channels.fetch(channels.MODERATION)
			if (channelMod) {
				await channelMod.send({
					embeds: [
						new EmbedBuilder()
							.setTitle('Usuarios con mas likes en creaciones')
							.setFooter({ text: 'Proximo reporte en 2 semanas' })
							.setDescription(
								allReactions.map(r => `${r.userId} | ${r.username} | Like: ${r.like} | Dislike: ${r.dislike}`)
									.join('\n')
							)
					]
				})
			}
		}
	} catch (error) {
		logger.ERR(error)
	}
}

/**
 * Starts the creation-reporting service and schedules report checks hourly.
 *
 * @param {import('mongodb').Db} _db - MongoDB database instance (unused; the
 *   service accesses the shared database through global.database).
 * @param {import('discord.js').Client} _client - Discord.js client instance
 *   (unused; the service accesses the shared guild through global.guild).
 * @returns {Promise<{stop: () => void, description: string, name: string, fullname: string}>}
 *   A service handle containing the stop function and service metadata.
 */
async function service(_db, _client) {
	const timeout = setInterval(createReport, 1000 * 60 * 60); // 1 hour

	return {
		stop: () => {
			clearInterval(timeout)
		},

		description: 'Service Log Threads Creations',
		name: 'service-threads-creations',
		fullname: 'Log Threads Creations'
	}
}

module.exports = {
	start: service
}