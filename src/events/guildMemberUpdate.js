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

const { Events, GuildMember, Client } = require("discord.js");
const logger = require('../logger');
const activity = require('../commands/leveling/activity');
const { Db } = require("mongodb");

module.exports = {
    name: Events.GuildMemberUpdate,
    once: true,
    /**
     * @param {Client} _client
     * @param {Db} _database
     * @param {GuildMember} oldMember
     * @param {GuildMember} newMember
     */
    async execute(_client, _database, oldMember, newMember) {
        try {
            if (oldMember.premiumSince !== newMember.premiumSince) {
                await activity.setUserHasBoosted(newMember.user.id, newMember.premiumSince !== null);
            }
        } catch (e) {
            logger.ERR(e)
        }
    }
};