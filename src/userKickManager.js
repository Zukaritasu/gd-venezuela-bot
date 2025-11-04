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

const { Db } = require("mongodb");
const { COLL_USER_KICKS } = require('../.botconfig/database-info.json');
const { User } = require("discord.js");
const logger = require("./logger");

/////////////////////////////////////////////////
// Tracks user expulsions (kicks) in the database

//////////////////////////////////////////////////

/**
 * @param {Db} db 
 * @param {User} user 
 */
async function trackUserExpulsion(db, user) {
	if (!db || !user) {
		return;
	}

	try {
		const userHistory = await db.collection(COLL_USER_KICKS).findOne({ userId: user.id });
		let result;

		const now = new Date();
		if (userHistory) {
			result = await db.collection(COLL_USER_KICKS).updateOne(
				{ _id: userHistory._id },
				{
					$set: {
						username: user.tag,
						lastKickedAt: now,
						updatedAt: now
					},
					$inc: {
						kickCount: 1
					},
					$push: {
						kicks: {
							timestamp: now,
							reason: "Account too new"
						}
					}
				}
			);
		} else {
			result = await db.collection(COLL_USER_KICKS).insertOne(
				{
					userId: user.id,
					username: user.tag,
					lastKickedAt: now,
					createdAt: now,
					updatedAt: now,
					kickCount: 1,
					kicks: [
						{
							timestamp: now,
							reason: "Account too new"
						}
					]
				}
			);
		}

		if (!result.acknowledged) {
			logger.ERR(`Failed to track kick for user ${user.tag} (${user.id}) in the database.`);
		}
	} catch (error) {
		logger.ERR(`Error tracking kick for user ${user.tag} (${user.id}): ${error}`);
	}
}

module.exports = {
	trackUserExpulsion
}