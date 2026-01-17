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

const { get } = require('http');
const https = require('https');


////////////////////////////////////////////////

/**
 * @typedef {Object} Placed
 * @property {number} new_position - New position assigned to the level.
 * @property {boolean} legacy - Indicates whether the action is legacy.
 */

/**
 * @typedef {Object} Raised
 * @property {number} new_position - New position assigned to the level.
 * @property {number} old_position - Previous position of the level.
 */

/**
 * @typedef {Object} Lowered
 * @property {number} new_position - New position assigned to the level.
 * @property {number} old_position - Previous position of the level.
 */

/**
 * @typedef {Object} MovedToLegacy
 * @property {number} new_position - New position assigned to the level.
 * @property {number} old_position - Previous position of the level.
 */

/**
 * @typedef {Object} Action
 * @property {Placed} [Placed]
 * @property {Raised} [Raised]
 * @property {Lowered} [Lowered]
 * @property {MovedToLegacy} [MovedToLegacy]
 */

/**
 * @typedef {Object} LevelReference
 * @property {string} id - Unique identifier of the level.
 * @property {string} name - Display name of the level.
 */

/**
 * @typedef {Object} ChangelogEntry
 * @property {Action} action - Action performed on the level, keyed by its type.
 * @property {string} created_at - Timestamp of the changelog entry (ISO 8601 format).
 * @property {LevelReference} affected_level - Level directly affected by the action.
 * @property {LevelReference | null} level_above - Level positioned above the affected level.
 * @property {LevelReference | null} level_below - Level positioned below the affected level.
 */

/**
 * @typedef {Object} LevelReference
 * @property {string} id - Unique identifier of the level.
 * @property {string} name - Display name of the level.
 */

/**
 * @typedef {Object} ChangelogResponse
 * @property {ChangelogEntry[]} data - List of changelog entries.
 * @property {number} page - Current page of the response.
 * @property {number} per_page - Number of entries per page.
 * @property {number} pages - Total number of available pages.
 */

/**
 * @typedef {Object} LevelInfo
 * @property {string} id - Unique UUID of the level.
 * @property {string} name - Name of the level.
 * @property {number} position - Position in the ranking.
 * @property {string} publisher_id - UUID of the publisher.
 * @property {number} points - Points assigned to the level.
 * @property {boolean} legacy - Indicates whether the level is legacy.
 * @property {number} level_id - Internal numeric ID of the level.
 * @property {boolean} two_player - Whether the level supports two players.
 * @property {string[]} tags - Descriptive tags for the level.
 * @property {string} description - Detailed description of the level.
 * @property {?string} song - ID of the associated song (can be null).
 * @property {number} edel_enjoyment - Enjoyment rating according to EDEL.
 * @property {boolean} is_edel_pending - Whether it's pending EDEL evaluation.
 * @property {?number} gddl_tier - Tier in the GDDL list, if applicable.
 * @property {?number} nlw_tier - Tier in the NLW list, if applicable.
 */


////////////////////////////////////////////////

/** @type {import('redis').RedisClientType} */
let redisObject = null

/**
 * Fetches JSON data from the specified URL, with optional Redis caching.
 * @param {string} url - URL path to fetch (without the domain)
 * @param {boolean} useRedis - Whether to use Redis caching or not
 * @returns 
 */
async function getResponseJSON(url, useRedis = true) {
    return new Promise(async (resolve) => {
        const options = {
            hostname: 'api.aredl.net',
            path: `/${url}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Edg/130.0.0.0',
                'upgrade-insecure-requests': 1
            }
        };

        const key = `${options.hostname}${options.path}`

        try {
            if (useRedis) {
                const response = await redisObject.get(key)
                if (response) {
                    return resolve(JSON.parse(response));
                }
            }
            https.get(options, res => {
                let data = [];
                res.on('error', error => {
                    resolve(error);
                });
                res.on('data', chunk => { data.push(chunk); });
                res.on('end', async () => {
                    try {
                        const jsonResponseData = JSON.parse(Buffer.concat(data).toString())
                        if (useRedis)
                            await redisObject.set(key, JSON.stringify(jsonResponseData), { EX: 21600 })
                        resolve(jsonResponseData)
                    } catch (error) {
                        resolve(error);
                    }
                });
            });
        } catch (error) {
            resolve(error);
        }
    });
}

module.exports = {
    setRedisClientObject: (redisObj) => redisObject = redisObj,

    /** @returns {Promise<LevelInfo[]>} */
    getLevels: async () => {
        const levels = await getResponseJSON('v2/api/aredl/levels');
        if (!(levels instanceof Error))
            for (let i = 0; i < levels.length; i++)
                levels[i].name = levels[i].name.trim();
        return levels;
    },
    getLevelsPlatformer: async () => {
        const levels = await getResponseJSON('v2/api/arepl/levels');
        if (!(levels instanceof Error))
            for (let i = 0; i < levels.length; i++)
                levels[i].name = levels[i].name.trim();
        return levels;
    },
    getLevelCreators: (level_id) => getResponseJSON(`v2/api/aredl/levels/${level_id}/creators`),
    getLevel: async (level_id) => {
        const level = await getResponseJSON(`v2/api/aredl/levels/${level_id}`);
        if (!(level instanceof Error) && 'name' in level)
            level.name = level.name.trim();
        return level;
    },

    /** @returns {Promise<ChangelogResponse>} */
    getChangelog: async () => {
        const changelog = await getResponseJSON('v2/api/aredl/changelog');
        if (changelog instanceof Error)
            return changelog;
        if (!('data' in changelog) || !Array.isArray(changelog.data))
            return new Error('Error fetching changelog');
        for (let i = 0; i < changelog.data.length; i++) {
            if ('affected_level' in changelog.data[i] && 'name' in changelog.data[i].affected_level)
                changelog.data[i].affected_level.name = changelog.data[i].affected_level.name.trim();
            if ('level_above' in changelog.data[i] && changelog.data[i].level_above !== null && 'name' in changelog.data[i].level_above)
                changelog.data[i].level_above.name = changelog.data[i].level_above.name.trim();
            if ('level_below' in changelog.data[i] && changelog.data[i].level_below !== null && 'name' in changelog.data[i].level_below)
                changelog.data[i].level_below.name = changelog.data[i].level_below.name.trim();
        }
        return changelog;
    },
    getLevelInfo: async (level_id) => {
        // json and creatorsArray never tend to be null because the function always returns a non-null value.
        const [json, creatorsArray] = await Promise.all(
            [
                getResponseJSON(`v2/api/aredl/levels/${level_id}`),
                getResponseJSON(`v2/api/aredl/levels/${level_id}/creators`)
            ]
        );

        if (json instanceof Error)
            throw json;
        if (creatorsArray instanceof Error)
            throw creatorsArray;
        if (!Array.isArray(creatorsArray))
            throw new Error('Error fetching creators');

        if ('name' in json)
            json.name = json.name.trim();
        json['creators'] = creatorsArray.length > 0 ? creatorsArray : [json.publisher];
        return json;
    },

    getLevelPlatformerInfo: async (level_id) => {
        // json and creatorsArray never tend to be null because the function always returns a non-null value.
        const [json, creatorsArray] = await Promise.all(
            [
                getResponseJSON(`v2/api/arepl/levels/${level_id}`),
                getResponseJSON(`v2/api/arepl/levels/${level_id}/creators`)
            ]
        );

        if (json instanceof Error)
            throw json;
        if (creatorsArray instanceof Error)
            throw creatorsArray;
        if (!Array.isArray(creatorsArray))
            throw new Error('Error fetching creators');

        if ('name' in json)
            json.name = json.name.trim();
        json['creators'] = creatorsArray.length > 0 ? creatorsArray : [json.publisher];
        return json;
    }
}