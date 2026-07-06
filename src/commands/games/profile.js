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

const { COLL_BOT_GAME_PROFILES } = require('../../../.botconfig/database-info.json')
const logger = require('../../logger')

/**
 * @typedef {Object} ProfileTimeout
 * 
 * @property {string} type - The type of timeout (e.g., "daily", "weekly").
 * @property {number} timestamp - The timestamp when the timeout expires.
 */

/**
 * @typedef {Object} Profile
 * 
 * @property {string} userId - The user ID of the profile.
 * @property {number} points - The number of points the user has.
 * @property {number} keys - The number of keys the user has.
 * @property {boolean} banned - Indicates whether the user is banned.
 * @property {ProfileTimeout[]} timeouts - An array of timeout objects associated with the profile.
 */

/**
 * Saves points to a user's profile in the database.
 * @param {string} userId - The user ID of the profile.
 * @param {number} points - The number of points to save.
 * @param {number | null} keys - The number of keys to save.
 * @param {string | null} type - The type of timeout (optional).
 * @param {number} timeOutMs - The timeout duration in milliseconds.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
async function savePoints(userId, points, keys, type, timeOutMs) {
    const collection = global.database.collection(COLL_BOT_GAME_PROFILES);

    const profile = await collection.findOne({ userId: userId });

	keys = keys !== null && keys !== undefined ? keys : (profile ? profile.keys : 0);

    if (!profile) {
        try {
            await collection.insertOne({
                userId: userId,
                points: points < 0 ? 0 : points,
                keys: keys,
                banned: false,
                timeouts: type ? [{ type: type, timestamp: Date.now() + timeOutMs }] : []
            });
            return;
        } catch (e) {
            logger.ERR(`Error creating profile for user ${userId}: ${e}`);
        }
    }

	if (points < 0 && profile.points + points < 0) {
		points = -profile.points; // Ensure points do not go below zero
	}

    if (type) {
        const nuevoTimestamp = Date.now() + timeOutMs;
        const tieneTimeout = profile.timeouts && profile.timeouts.some(t => t.type === type);

        if (tieneTimeout) {
            await collection.updateOne(
                { userId: userId, "timeouts.type": type },
                { 
                    $inc: { points: points, keys: keys },
                    $set: { "timeouts.$.timestamp": nuevoTimestamp }
                }
            );
        } else {
            await collection.updateOne(
                { userId: userId },
                { 
                    $inc: { points: points, keys: keys },
                    $push: { timeouts: { type: type, timestamp: nuevoTimestamp } }
                }
            );
        }
    } else {
        await collection.updateOne(
            { userId: userId },
            { $inc: { points: points, keys: keys } }
        );
    }
}

module.exports = {
	savePoints,
	isCooldownActive: async function(userId, type) {
		const collection = global.database.collection(COLL_BOT_GAME_PROFILES);
		const profile = await collection.findOne({ userId: userId });

		if (!profile || !profile.timeouts) return false;

		const timeout = profile.timeouts.find(t => t.type === type);

		return timeout && timeout.timestamp > Date.now();
	}
};