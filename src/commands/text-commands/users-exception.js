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
const logger = require("../../logger");
const { COLL_TEXT_XP } = require('../../../.botconfig/database-info.json');

///////////////////////////////////

const DB_TYPE_OBJECT = 'usersException'

/**
 * @param {string} userId 
 * @param {Db} database
 * @param {Message} message
 */
async function addUser(userId, database, message) {
	try {
		const collection = database.collection(COLL_TEXT_XP);
		const { acknowledged, upsertedCount } = await collection.updateOne(
			{ type: DB_TYPE_OBJECT },
			{
				$setOnInsert: {
					type: DB_TYPE_OBJECT, users: []
				}
			},
			{ upsert: true }
		);

		if (acknowledged || upsertedCount) {
			const updateResult = await collection.updateOne(
				{ type: DB_TYPE_OBJECT },
				{
					$addToSet: {
						users: userId
					}
				}
			);

			await message.react(updateResult.modifiedCount ? '✅' : '❌');
		} else {
			await message.react('❌');
		}

		await removeRole(userId, message)
	} catch (error) {
		logger.ERR(error);
		try {
			await message.reply('Oops! An error has occurred [addUser] <:birthday2:1249345278566465617>');
		} catch (replyError) {
			logger.ERR(replyError);
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
			{ type: DB_TYPE_OBJECT },
			{
				$setOnInsert: {
					type: DB_TYPE_OBJECT, users: []
				}
			},
			{ upsert: true }
		);

		if (acknowledged || upsertedCount) {
			const updateResult = await collection.updateOne(
				{ type: DB_TYPE_OBJECT },
				{
					$pull: {
						users: userId
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
 * Returns the list of members (ID) within the usersException
 * @param {Db} database 
 * @returns {Promise<string[]>}
 */
async function getUsersException(database) {
	const collTextXP = await database.collection(COLL_TEXT_XP).findOne(
		{ type: DB_TYPE_OBJECT },
		{
			projection: 
			{ 
				users: 1, 
				_id: 0 
			}
		}
	);

	return collTextXP ? collTextXP.users : [];
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

		if (params[0].toLowerCase() == 'add')
			return await addUser(userId, database, message)
		else if (params[0].toLowerCase() == 'remove')
			return await removeUser(userId, database, message)
		else
			return await message.reply('Action unknown. Enter a valid action')
	} catch (error) {
		logger.ERR(error);
		try {
			await message.reply('Oops! An error has occurred <:birthday2:1249345278566465617>');
		} catch (replyError) {
			logger.ERR(replyError);
		}
	}
}

module.exports = {
	addUser,
	removeUser,
	getUsersException,
	process
}