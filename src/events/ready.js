/**
 * Copyright (C) 2024 Zukaritasu
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

const { Events } = require('discord.js');
const logger = require('../logger')

const services = [
	'../commands/youtube/service-notification.js'
]

module.exports = {
	name: Events.ClientReady,
	once: true,

	async execute(client, database) {
		// disconect afk users
		/*await require('./voiceStateUpdate').scanAndDisconnectUsers(client)
		await require('./voiceStateUpdate').scanVoiceChannels(client)*/

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
		// Load server members into the cache

		const guild = client.guilds.cache.get('1119795689984102455' /* GD Venezuela server ID */)
		if (guild !== undefined) {
			try {
				await guild.members.fetch();
				logger.INF('All members have been loaded into the cache!')
			} catch (e) {
				logger.ERR(e)
			}
		}
	},
};