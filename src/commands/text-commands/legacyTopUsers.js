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
const logger = require("../../logger.js");

/**
 * Adds or removes a user from the legacy top users list.
 * This function updates the database to either add or remove
 * the user from the legacy top users list based on the action specified.
 * 
 * @param {Message} message 
 * @param {Db} database 
 * @param {string} userId
 * @param {boolean} action
 * 
 * @returns {Promise<void>}
 */
async function addOrRemove(message, database, userId, action) {
    try {
        const modifier = action
            ? { $addToSet: { users: userId } }
            : { $pull: { users: userId } };

        const result = await database.collection('xp').updateOne(
            { type: 'legacyToUsers' },
            modifier,
            { upsert: true }
        );

        if (!result.acknowledged) {
            return await message.reply('Database modification failed.');
        }

        await message.react('✅');
    } catch (e) {
        logger.ERR(e);
        try {
            await message.react('❌');
            await message.reply('Error: ' + e.message);
        } catch (err) {
            logger.ERR(err);
        }
    }
}

module.exports = {
    add: (message, database, userId) => addOrRemove(message, database, userId, true),
    remove: (message, database, userId) => addOrRemove(message, database, userId, false),
}