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

const { Events, Client, ChatInputCommandInteraction, Message, GuildMember, AttachmentBuilder, ChannelType, Guild, VoiceChannel, VoiceState } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../../logger');
const { COLL_USERS_ACTIVITY } = require('../../../.botconfig/database-info.json')

/** Prefix for Redis keys to store user activity data */
const PREFIX_USER_ACTIVITY = 'gdvzla-user-activity:';
const PREFIX_USER_ACTIVITY_VOICE = 'gdvzla-user-activity-voice:';

const KEY_USERS_BOOSTERS = 'gdvzla-users-boosters';

const KEY_IS_LOADED_ACTIVITY = 'gdvzla-loaded-activity';

/** Key for Redis set to track dirty users (updated activity) */
const KEY_DIRTY_USERS = 'gdvzla-dirty-users';

/** 60 seconds cooldown for logging user activity */
const COOLDOWN_TIME = 60000;

/**
 * @typedef {Object} UserActivity
 * @property {string} userId - The ID of the user.
 * @property {string} userName - The name of the user.
 * @property {number} points - The total points earned by the user.
 * @property {number|undefined} lastActivity - The timestamp of the user's last activity.
 * @property {number|undefined} lastBoostCheck - The timestamp of the last time the user's booster status was checked.
 * @property {boolean|undefined} isBooster - Whether the user is currently a booster.
 * @property {number} version - Version number for optimistic locking.
 */

/**
 * Returns the user activity data for a given user ID.
 * 
 * This function retrieves the user activity data from the Redis cache. If the data is
 * not found in the cache, it returns undefined. If there is an error while fetching
 * the data, it logs the error and returns null.
 * 
 * 
 * @param {string} userId - The ID of the user whose activity data is to be retrieved.
 * @returns {Promise<UserActivity|null>} - Returns the user activity data,
 * or null if not found or an error occurs.
 */
async function getUserActivity(userId) {
	if (!global.redisClient) return null;

	const response = await global.redisClient.get(PREFIX_USER_ACTIVITY + userId);
	if (response) {
		return JSON.parse(response)
	}
	
	return null
}

/**
 * Updates the user activity data for a given user ID.
 * 
 * This function updates the user activity data in the Redis cache. It takes the user ID
 * and the updated user activity data as parameters. If there is an error while updating the data, it
 * logs the error.
 * @param {string} userId - The ID of the user.
 * @param {UserActivity} userActivity - The updated user activity data to be stored in the cache.
 * @returns {Promise<boolean>} - Returns true if the update was successful, false otherwise.
 */
async function updateUserActivity(userActivity) {
	try {
		if (!global.redisClient) return false;

		const key = PREFIX_USER_ACTIVITY + userActivity.userId;
		let retries = 3;

		while (retries > 0) {
			await global.redisClient.watch(key);

			const currentData = await global.redisClient.get(key);
			if (currentData) {
				const currentActivity = JSON.parse(currentData);
				if (currentActivity.version !== userActivity.version) {
					await global.redisClient.unwatch();
					retries--;
					continue;
				}
			}

			userActivity.version++;

			const multi = global.redisClient.multi();
			multi.set(key, JSON.stringify(userActivity));
			multi.sAdd(KEY_DIRTY_USERS, userActivity.userId);

			const results = await multi.exec();
			if (results) {
				return true;
			} else {
				retries--;
			}
		}

		logger.ERR('Failed to update user activity after retries due to conflicts ' + 
			`for userId: ${userActivity.userId}`);
		return false;
	} catch (error) {
		logger.ERR(error);
		return false;
	}
}

/**
 * Checks if a user is a booster in the guild.
 * 
 * @param {Guild} guild - The guild to check for the booster role.
 * @param {UserActivity} userActivity - The user activity data for the user to check.
 * @returns {Promise<boolean>} - Returns true if the user is a booster, false otherwise.
 */
async function isUserBooster(guild, userActivity) {
	try {
		if (!global.redisClient) return false;

		// Function to reset the booster check for a user and update the Redis
		// cache with the new booster status.
		// This function fetches the member object for the user, checks if they
		// have the booster role, updates the Redis cache with the new booster
		// status, and updates the last boost check timestamp in the user activity data.
		const resetUserBoostCheck = async () => {
			const member = await guild.members.fetch(userActivity.userId);
			const isBooster = member.roles.cache.has(process.env.ID_ROL_BOOSTER);
			await global.redisClient.hSet(KEY_USERS_BOOSTERS, userActivity.userId, isBooster.toString());
			userActivity.lastBoostCheck = Date.now();
			userActivity.isBooster = isBooster;
			return isBooster;
		}

		const state = await global.redisClient.hGet(KEY_USERS_BOOSTERS, userActivity.userId);
		if (state) {
			// Check if we need to refresh the booster status (every 2 hours)
			if ((Date.now() - userActivity.lastBoostCheck) > 2 * 60 * 60 * 1000) {
				return await resetUserBoostCheck();
			}
			return state === 'true';
		}

		return await resetUserBoostCheck();
	} catch (error) {
		logger.ERR(error);
		return false;
	}
}

/**
 * Loads the backup data from the database.
 * @param {Db} db - The database object.
 * @returns {Promise<boolean>} - Returns a promise that resolves when the backup data is loaded.
 */
async function loadBackupData(db) {
	try {

		// To prevent the bot from loading the MongoDB backup, a key is set which,
		// if it exists, prevents the backup from being loaded, but if it does not
		// exist, the backup is loaded (for example, in the event of a power outage).
		const isLoaded = await global.redisClient.get(KEY_IS_LOADED_ACTIVITY);
		if (isLoaded) return

		await global.redisClient.set(KEY_IS_LOADED_ACTIVITY, "true");

		const cursor = db.collection(COLL_USERS_ACTIVITY).find({});
		const allUsers = await cursor.toArray();

		if (allUsers.length > 0) {
			for (const user of allUsers) {
				const userId = user.userId;
				if (user.isBooster === undefined || user.isBooster === null)
					user.isBooster = false;
				if (user.version === undefined)
					user.version = 0;
				await global.redisClient.set(PREFIX_USER_ACTIVITY + userId, JSON.stringify(user));
				await global.redisClient.hSet(KEY_USERS_BOOSTERS, userId, user.isBooster.toString());
			}
		}

		return true
	} catch (error) {
		logger.ERR(error);
	}

	return false
}

/**
 * Gets the user's position in the leaderboard.
 * 
 * This function retrieves the user's position in the leaderboard based on their
 * points. It fetches all user activity data from the Redis cache, sorts it by
 * points, and determines the user's rank. If there is an error while fetching
 * the data, it logs the error and returns null.
 * 
 * @param {Db} db - The database object (not currently used but available for future enhancements).
 * @param {ChatInputCommandInteraction} interaction - The interaction object from the command.
 * @returns {Promise<UserActivity|null>} - Returns the user's position in the leaderboard
 * or null if an error occurs.
 */
async function getUserActivityData(db, interaction) {
	try {
		const userId = interaction.user.id;

		const currentUser = await db.collection(COLL_USERS_ACTIVITY).findOne(
			{ userId: userId },
			{ projection: { userId: 1, points: 1, voicePoints: 1, userName: 1 } }
		);

		if (!currentUser) return null;

		const [usersAbove, voiceUsersAbove] = await Promise.all([
			db.collection(COLL_USERS_ACTIVITY).countDocuments({ points: { $gt: currentUser.points } }),
			db.collection(COLL_USERS_ACTIVITY).countDocuments({ voicePoints: { $gt: currentUser.voicePoints } })
		]);

		currentUser['position'] = usersAbove + 1;
		currentUser['voicePosition'] = voiceUsersAbove + 1;

		return currentUser;
	} catch (error) {
		logger.ERR(error);
		return null;
	}
}

/**
 * Gets the top users in the leaderboard.
 * 
 * This function retrieves the top users in the leaderboard based on their points. It
 * accepts pagination parameters to determine which set of users to return. If there
 * is an error while fetching the data, it logs the error and returns an empty array.
 * 
 * 
 * @param {Db} db - The database object (not currently used but available for future enhancements).
 * @param {number} page - The page number for pagination (default is 1).
 * @param {string} type - The type of leaderboard to generate ('text', 'voice').
 * @param {number} limit - The number of users to return per page (default is 10).
 * @returns {Promise<UserActivity[]>} - Returns an array of top users in the leaderboard.
 */
async function getTopUsers(db, page = 1, type = 'text', limit = 10) {
	try {
		const skip = (page - 1) * limit;
		const sortField = type === 'voice' ? 'voicePoints' : 'points';

		const topUsers = await db.collection(COLL_USERS_ACTIVITY)
			.find({ [sortField]: { $gt: 0 } }, {
				projection: {
					_id: 0,
					userId: 1,
					userName: 1,
					points: 1,
					voicePoints: 1
				}
			})
			.sort({ [sortField]: -1 })
			.skip(skip)
			.limit(limit)
			.toArray();

		return topUsers;
	} catch (error) {
		logger.ERR(error);
		return [];
	}
}

/**
 * Gets the top users data for the leaderboard, including pagination information.
 * 
 * This function retrieves the top users in the leaderboard along with pagination
 * information such as total pages and current page. It uses the getTopUsers
 * function to fetch the users and calculates the total number of pages based on
 * the total number of users in the database. If there is an error while fetching
 * the data, it logs the error and returns an object with empty users and pagination
 * information.
 * 
 * 
 * @param {Db} db - The database object (not currently used but available for
 * future enhancements).
 * @param {number} page - The page number for pagination (default is 1).
 * @param {string} type - The type of leaderboard to generate ('text', 'voice').
 * @param {number} limit - The number of users to return per page (default is 10).
 * @returns {Promise<{ users: UserActivity[], totalPages: number, currentPage: number }>}
 * Returns an object containing the top users and pagination information.
 */
async function getTopUsersData(db, page = 1, type = 'text', limit = 10) {
	const collection = db.collection(COLL_USERS_ACTIVITY);
	const sortField = type === 'voice' ? 'voicePoints' : 'points';

	const [users, totalUsers] = await Promise.all([
		getTopUsers(db, page, type, limit), collection.countDocuments({ [sortField]: { $gt: 0 } })
	]);

	return {
		users,
		totalPages: Math.ceil(totalUsers / limit),
		currentPage: page
	};
}

/**
 * Gets the default user activity object for a new user.
 * 
 * This function returns a default user activity object for a new user who has not
 * been previously recorded in the system. The object includes the user's ID, name,
 * initial points, and timestamps for activity and booster checks. This is used when
 * a new user is encountered and needs to be initialized in the activity tracking system.
 * 
 * @param {string} userName - The name of the user.
 * @param {string} userId - The ID of the user.
 * @returns {UserActivity} - Returns a default user activity object for the new user.
 */
function getDefaultUserActivityObject(userName, userId) {
	return {
		userId: userId,
		userName: userName,
		points: 0,
		voicePoints: 0,
		lastActivity: 0,
		lastBoostCheck: Date.now(),
		isBooster: false,
		version: 0
	};
}

/**
 * User activity log
 * 
 * This feature logs the activities of all users on the server when they
 * send a message, including emojis, stickers, links, images, slash commands, etc
 * 
 * @param {Db} _db - The database object (not currently used but available for future enhancements).
 * @param {Guild} guild - The Discord guild where the message was sent.
 * @param {string} message - The content of the message.
 * @param {boolean} containsAttachment - Whether the message contains an attachment.
 * @param {string} userId - The ID of the user who sent the message.
 * @param {string} userName - The name of the user who sent the message.
 */
async function log(_db, guild, message, containsAttachment, userId, userName) {
	try {
		let userActivity = await getUserActivity(userId);

		if (userActivity === null) {
			userActivity = getDefaultUserActivityObject(userName, userId);
		} else if ((Date.now() - userActivity.lastActivity) < COOLDOWN_TIME) {
			// User is on cooldown, do not log activity
			return;
		}

		userActivity.lastActivity = Date.now();

		let points = 0;
		if (message.length < 100) {
			points += 15;
		} else if (message.length >= 100 && message.length <= 300) {
			points += 15 + Math.floor(((message.length - 100) / 200) * 10);
		} else {
			points += 25;
		}

		if (containsAttachment) {
			points += 10;
		}

		const isBooster = await isUserBooster(guild, userActivity);
		if (isBooster) {
			points = Math.floor(points * 1.2);
		}

		userActivity.points += points;

		// Update lastBoostCheck if it was modified by isUserBooster
		await updateUserActivity(userActivity);
	} catch (error) {
		logger.ERR(error);
	}
}

/**
 * Handles voice state updates for users in the guild.
 * 
 * This function is triggered whenever a user's voice state changes (e.g.,
 * joining or leaving a voice channel). It updates the user's activity data
 * in the Redis cache to track their voice channel activity.
 * 
 * If there is an error while processing the voice state update, it logs the error.
 * 
 * 
 * @param {VoiceState} oldState 
 * @param {VoiceState} newState 
 */
async function voiceEvent(oldState, newState) {
	if (oldState.channelId !== null && newState.channelId !== null)
		return; // User switched channels, do not log activity

	const user = newState.member.user;

	if (!user || user.bot) return; // Ignore if user is not found or is a bot

	if (newState.channelId !== null) {
		// To proceed with monitoring the user connected to the voice
		// channel, the user must have an instantiated userActivity object.
		let userActivity = await getUserActivity(user.id);
		if (userActivity === null) {
			userActivity = getDefaultUserActivityObject(user.username, user.id);
			if (!await updateUserActivity(userActivity)) {
				return; // error updating user activity, do not proceed
			}
		}

		await global.redisClient.set(PREFIX_USER_ACTIVITY_VOICE + user.id, JSON.stringify({
			userId: user.id,
			joinedAt: Date.now()
		}));
	} else {
		// User left the voice channel, calculate the time spent and update points
		const temp = await global.redisClient.get(PREFIX_USER_ACTIVITY_VOICE + user.id);
		if (temp) {
			const voiceStatus = JSON.parse(temp);
			const userActivity = await getUserActivity(user.id);
			if (userActivity) {
				// Calculate voice points based on the time spent in the voice channel
				if (userActivity.voicePoints === undefined)
					userActivity.voicePoints = 0;
				userActivity.voicePoints += Math.floor((Date.now() - voiceStatus.joinedAt) / 60000) * 4;
				await updateUserActivity(userActivity);
			}
		}
		await global.redisClient.del(PREFIX_USER_ACTIVITY_VOICE + user.id);
	}
}

module.exports = {
	log,
	getUserActivityData,
	getTopUsersData,
	voiceEvent,

	/**
	 * Sets the user as a booster in the Redis cache.
	 * This function updates the Redis cache to indicate that a user is a booster. It checks
	 * if the user is already marked as a booster in the cache, and if not, it sets the
	 * value to 'true'. If there is an error while updating the cache, it logs the error.
	 * 
	 * @param {string} userId - The ID of the user to be marked as a booster.
	 * @param {boolean} hasBoosted - Whether the user has boosted the server.
	 * @returns {Promise<void>} - Returns a promise that resolves when the operation is complete.
	 */
	setUserHasBoosted: async (userId, hasBoosted) => {
		try {
			if (!global.redisClient) return;
			const state = await global.redisClient.hGet(KEY_USERS_BOOSTERS, userId);
			if (state !== null && state === hasBoosted.toString())
				return;
			await global.redisClient.hSet(KEY_USERS_BOOSTERS, userId, hasBoosted.toString());
		} catch (error) {
			logger.ERR(error);
		}
	},

	/**
	 * Sets the Redis client object for the activity module.
	 * This function is used to provide the Redis client object to the activity module,
	 * allowing it to interact with the Redis cache for storing and retrieving user
	 * activity data. It also sets up a periodic backup of the user activity data every 15 minutes.
	 * 
	 * @param {Db} db - The database object used for backing up user activity data.
	 */
	setRedisClientObject: async (db) => {
		const error = await loadBackupData(db);

		// If there is a Redis, network, or MongoDB error, for security reasons,
		// the timer is not started to avoid errors
		if (!error) return

		// sync dirty user activity data to MongoDB every 15 minutes
		setInterval(async () => {
			try {
				if (!global.redisClient || !db) return;

				// Get all dirty users
				const dirtyUserIds = await global.redisClient.sMembers(KEY_DIRTY_USERS);
				if (dirtyUserIds.length === 0) return;

				const operations = [];

				for (const userId of dirtyUserIds) {
					const data = await global.redisClient.get(PREFIX_USER_ACTIVITY + userId);
					if (data) {
						const jsonData = JSON.parse(data);
						const voiceStatusData = await global.redisClient.get(PREFIX_USER_ACTIVITY_VOICE + userId);
						if (voiceStatusData) {
							const voiceStatus = JSON.parse(voiceStatusData);
							// Calculate voice points based on the time spent in the voice channel
							if (jsonData.voicePoints === undefined)
								jsonData.voicePoints = 0;
							jsonData.voicePoints += Math.floor((Date.now() - voiceStatus.joinedAt) / 60000) * 4;
						}

						operations.push({
							updateOne: {
								filter: { userId: userId },
								update: {
									$set: {
										userId: jsonData.userId,
										userName: jsonData.userName,
										points: jsonData.points,
										voicePoints: jsonData.voicePoints,
										lastActivity: jsonData.lastActivity,
										lastBoostCheck: jsonData.lastBoostCheck,
										isBooster: jsonData.isBooster,
										version: jsonData.version,
										lastUpdate: new Date()
									}
								},
								upsert: true
							}
						});
					}
				}

				if (operations.length > 0) {
					await db.collection(COLL_USERS_ACTIVITY).bulkWrite(operations);
					// Clear dirty set after successful sync
					await global.redisClient.del(KEY_DIRTY_USERS);
					logger.INF(`[Backup] Synchronized ${operations.length} users to MongoDB`);
				}
			} catch (error) {
				logger.ERR(error);
			}
		}, 300000); // 5 minute in milliseconds
	}
}