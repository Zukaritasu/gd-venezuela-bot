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

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client, _database) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		// Load server members into the cache
		const guild = client.guilds.cache.get('1119795689984102455' /* GD Venezuela server ID */)
		if (guild !== undefined) {
			try {
				await guild.members.fetch();
				console.log('All members have been loaded into the cache!');
			} catch (e) {
				console.log(e)
			}
		}
	},
};