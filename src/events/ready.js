/**
 * Copyright (C) 2024 - 2026 Zukaritasu
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

const { Events, Client, RateLimitError } = require('discord.js');
const logger = require('../logger');
const utils = require('../utils');

const services = [
	'../services/service-levels.js',
	'../services/service-levels-p.js',
	'../services/service-xp-auto-update.js',
	'../services/service-leaderboard-creator-point.js',
	'../services/service-youtube-notifications.js'
]

module.exports = {
	name: Events.ClientReady,
	once: true,

	async execute(client, database) {
		await require('./voiceStateUpdate').scanVoiceChannelsActivity(client)
		await require('../commands/records/submit').checkNewSubmitRecords(client, database)
		
		// Load server members into the cache
		const guild = client.guilds.cache.get(process.env.SERVER_GD_VENEZUELA_ID)
		if (guild) {
			try {
				const allMembers = await utils.getAllMembers(guild)
				if (allMembers) {
					await require('../checkAccounts').checkAllUsersAccountAge(guild, database, allMembers);
					await require('../commands/leveling/activity').verifyGuildMembers(allMembers);
				}
			} catch (e) {
				logger.ERR(e)
			}
		}

		// Load services

		for (let i = 0; i < services.length; i++) {
			try {
				const info = await require(services[i]).start(database, client)
				logger.INF(`Service ${info.fullname} has been loaded!`)
			} catch (error) {
				logger.ERR(`Error loading service: ${error.message}`)
			}
		}

		logger.INF(`Ready! Logged in as ${client.user.tag}`)
	},
};