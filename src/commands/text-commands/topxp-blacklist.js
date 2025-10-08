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

const { Message } = require("discord.js");
const { Db } = require("mongodb");
const topLimits = require("../../../.botconfig/top-limits.json")
const logger = require("../../logger");
const { COLL_TEXT_XP } = require('../../../.botconfig/database-info.json');

/**
 * @param {string} userId
 * @param {Message} message
 * @returns {Promise<void>}
 */
async function removeRole(userId, message) {
    try {
        const member = await message.guild.members.fetch(userId)
        if (!member)
                return await message.reply('User not found. Failed to remove user role')
            await member.roles.remove(topLimits.starsRoleID, `User added to Top ${topLimits.positions} blacklist`)
        await message.reply('Role removed successfully!')
    } catch (e) {
        try {
            logger.ERR('Error in removeRole:', e);
            await message.reply('Oops! An error has occurred [removeRole] <:birthday2:1249345278566465617>');
        } catch (replyError) {
            logger.ERR('Error sending error reply:', replyError);
        }
    }
}

/**
 * @param {string} userId 
 * @param {Db} database
 * @param {Message} message
 */
async function addUser(userId, database, message) {
    try {
        const collection = database.collection(COLL_TEXT_XP);
        const { acknowledged, upsertedCount } = await collection.updateOne(
            { type: 'blacklist' },
            {
                $setOnInsert: {
                    type: 'blacklist', blacklist: []
                }
            },
            { upsert: true }
        );

        if (acknowledged || upsertedCount) {
            const updateResult = await collection.updateOne(
                { type: 'blacklist' },
                {
                    $addToSet: {
                        blacklist: userId
                    }
                }
            );

            await message.react(updateResult.modifiedCount ? '✅' : '❌');
        } else {
            await message.react('❌');
        }

        await removeRole(userId, message)
    } catch (error) {
        logger.ERR('Error in addUser:', error);
        try {
            await message.reply('Oops! An error has occurred [addUser] <:birthday2:1249345278566465617>');
        } catch (replyError) {
            logger.ERR('Error sending error reply:', replyError);
        }
    }
}

/**
 * @param {string} userId
 * @param {Db} database
 * @param {Message} message
 */
async function removeUser(userId, database, message) {
    try {
        const collection = database.collection(COLL_TEXT_XP);
        const { acknowledged, upsertedCount } = await collection.updateOne(
            { type: 'blacklist' },
            {
                $setOnInsert: {
                    type: 'blacklist', blacklist: []
                }
            },
            { upsert: true }
        );

        if (acknowledged || upsertedCount) {
            const updateResult = await collection.updateOne(
                { type: 'blacklist' },
                {
                    $pull: {
                        blacklist: userId
                    }
                }
            );

            await message.react(updateResult.modifiedCount > 0 ? '✅' : '❌');
        } else {
            await message.react('❌');
        }
    } catch (error) {
        logger.ERR('Error in removeUser:', error);
        try {
            await message.reply('Oops! An error has occurred [removeUser] <:birthday2:1249345278566465617>');
        } catch (replyError) {
            logger.ERR('Error sending error reply:', replyError);
        }
    }
}

/** 
 * The array must contain the action and the user ID
 * 
 * @param {string[]} params 
 * @param {Db} database
 * @param {Message} message
 */
async function process(params, database, message) {
    try {
        if (params.length < 2)
            return await message.reply('Insufficient parameters')
        const userId = params[1]

        try {
            if (!(await message.guild.members.fetch(userId)))
                return await message.reply('The user does not exist on the server')
        } catch (error) {
            return await message.reply('The user does not exist on the server')
        }

        if (params[0] == 'add')
            return await addUser(userId, database, message)
        else if (params[0] == 'remove')
            return await removeUser(userId, database, message)
        else
            return await message.reply('Action unknown. Enter a valid action')
    } catch (error) {
        logger.ERR(error);
        try {
            await message.reply('Oops! An error has occurred <:birthday2:1249345278566465617>');
        } catch (replyError) {
            logger.ERR('Error sending error reply:', replyError);
        }
    }
}

module.exports = {
    addUser,
    removeUser,
    process
}