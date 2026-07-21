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

const { Events, Client, GuildMember } = require('discord.js');
const logger = require('../logger')

module.exports = {
	name: Events.GuildMemberRemove,
	once: false,
	/**
	 * @param {Client} _
	 * @param {Db} database
	 * @param {GuildMember} member
	 */
	async execute(_, database, member) {
		try {
			await require('../commands/leveling/activity').removeMember(database, member)
		} catch (e) {
			logger.ERR(e)
		}
	}
};