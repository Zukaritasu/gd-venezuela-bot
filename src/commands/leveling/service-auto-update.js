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
const { COLL_USERS_ACTIVITY_CONFIG, doc_types } = require('../../../.botconfig/database-info.json');
const activity = require('./activity')
const topLimits = require('../../../.botconfig/top-limits.json');
const logger = require('../../logger');
const { Db } = require('mongodb');
const { Client } = require('discord.js');

const TIME_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Checks if the list of users with the "stars" role can be updated based on the last
 * update time stored in the database.
 * If the list can be updated, it updates the last update time to the current time.
 * 
 * @param {Db} db - The MongoDB database instance to check and update the last update time.
 * @return {Promise<boolean>} - Returns true if the list can be updated, false otherwise.
 */
async function isListUpdatable(db) {
	const now = new Date();
	const doc = await db.collection(COLL_USERS_ACTIVITY_CONFIG).findOne(
		{ type: doc_types.SAU_TYPE_LAST_UPDATE_QUERY });

	if (!doc) {
		await db.collection(COLL_USERS_ACTIVITY_CONFIG).insertOne({
			type: doc_types.SAU_TYPE_LAST_UPDATE_QUERY,
			timeLastUpdate: now
		});
		return true;
	}

	const lastUpdate = doc.timeLastUpdate ? new Date(doc.timeLastUpdate) : null;

	if (!lastUpdate || (now - lastUpdate) >= TIME_INTERVAL) {
		await db.collection(COLL_USERS_ACTIVITY_CONFIG).updateOne(
			{ type: doc_types.SAU_TYPE_LAST_UPDATE_QUERY },
			{ $set: { timeLastUpdate: now } }
		);
		return true;
	}

	return false;
}

/**
 * Removes the specified role from members who are either blacklisted or not in the current top users list.
 * 
 * @param {Guild} guild - The Discord guild where the role is assigned.
 * @param {Set<string>} blMembers - The list of blacklisted member IDs.
 * @param {string[]} currentTopUserIds - The list of current top user IDs who should retain the role.
 * @return {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
async function removeRoleFromInvalidMembers(guild, blMembers, currentTopUserIds) {
    const role = await guild.roles.fetch(process.env.ID_ROL_ESTRELLAS);

	if (!role) {
		logger.ERR('Guild or role not found for processing user stars role');
		return false
	}

	for (const [id] of role.members) {
		if (blMembers.has(id) || !currentTopUserIds.includes(id)) {
			//await member.roles.remove(role.id, 'The user has dropped out of the TOP ${topLimits.limit} or is on the blacklist');
			//logger.DBG(`Would remove role from member ${id} (blacklisted: ${blMembers.has(id)}, in top users: ${currentTopUserIds.includes(id)})`);
		}
	}

	return true
}

/**
 * Processes the users who should have the "stars" role based on their activity and exceptions.
 * It removes the role from users who are blacklisted or not in the current top users list, and
 * adds it to those who are in the top users or are exceptions.
 * 
 * @param {Db} db - The MongoDB database instance to fetch user configurations.
 * @param {Guild} guild - The Discord guild where the role is assigned.
 */
async function processUsersStarsRole(db, guild) {
    const configDocs = await db.collection(COLL_USERS_ACTIVITY_CONFIG).find(
		{
        	type: { 
				$in: [
					doc_types.SAU_TYPE_USER_EXCEPTION_LIST, 
					doc_types.SAU_TYPE_USERS_BLACKLIST
				] 
			}
		}
	).toArray();

    const getSet = (type) => new Set(configDocs.find(doc => doc.type === type)?.users || []);

	/** @type {Set<string>} */
    const excMembers = getSet(doc_types.SAU_TYPE_USER_EXCEPTION_LIST);
	/** @type {Set<string>} */
    const blMembers = getSet(doc_types.SAU_TYPE_USERS_BLACKLIST);

	// The list already contains filtered users, excluding banned
	// and blacklisted users
    const currentTopXp = await activity.getTopUsersData(db, 1, 'text', topLimits.limit);
	const currentTopUserIds = currentTopXp.users.map(u => u.userId);

    if (!await removeRoleFromInvalidMembers(guild, blMembers, currentTopUserIds))
		return

	const candidates = new Set([
		...[...excMembers].filter(id => !blMembers.has(id)), // Exceptions that are not blacklisted
		...currentTopUserIds.slice(0, topLimits.positions)
	]);
	
	// Add role to members
	for (const userId of candidates) {
		const member = await guild.members.fetch(userId).catch(() => null);
		if (member && !member.roles.cache.has(process.env.ID_ROL_ESTRELLAS)) {
			//await member.roles.add(process.env.ID_ROL_ESTRELLAS, `The user has entered the TOP 25 ${topLimits.limit}`);
			//logger.DBG(`Would add role to member ${userId} (in top users: ${currentTopXp.users.some(u => u.userId === userId)}, is exception: ${excMembers.has(userId)})`);
		}
	}
}

async function service(_db, client) {
	const guild = await client.guilds.fetch(process.env.SERVER_GD_VENEZUELA_ID);
	if (!guild) {
		throw new Error(`Guild not found ${process.env.SERVER_GD_VENEZUELA_ID}`);
	}

	const functionRun = async () => {
		try {
			if (await isListUpdatable(global.database)) {
				await processUsersStarsRole(global.database, guild);
				await require('../text-commands/update-leaderboard').update(global.database, guild);
			}
		} catch (error) {
			logger.ERR(error);
		}
	}

	await functionRun();

	const timeout = setInterval(functionRun, 4 * 60 * 60 * 1000); // 4 hour

	return {
        stop: () => clearInterval(timeout),

        description: '(XP) Auto update service for roles/leaderboard',
        name: 'service-auto-update',
        fullname: '(XP) Auto update service for roles/leaderboard'
    }
}

module.exports = { start: service }