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

const { Events, GuildMember, Client } = require("discord.js");
const logger = require('../logger');
const activity = require('../commands/leveling/activity');
const { Db } = require("mongodb");
const ban = require('../security/ban');

module.exports = {
    name: Events.GuildMemberUpdate,
    once: true,
    /**
     * Executes when a guild member is updated.
     * 
     * @param {Client} _client - The Discord client instance
     * @param {Db} _database - The MongoDB database instance
     * @param {GuildMember} oldMember - The member before the update
     * @param {GuildMember} newMember - The member after the update
     */
    async execute(_client, _database, oldMember, newMember) {
        try {
            if (oldMember.premiumSince !== newMember.premiumSince) {
                if (ban.banUserIfNoRoles(newMember.guild, newMember.user.id)) {
                    return;
                }
                await activity.setUserHasBoosted(newMember.user.id, newMember.premiumSince !== null);
            }
        } catch (e) {
            logger.ERR(e)
        }
    }
};