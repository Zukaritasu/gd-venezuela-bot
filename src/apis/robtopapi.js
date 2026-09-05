/**
 * Copyright (C) 2024 - 2026 Zukaritasu
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

const axios = require('axios');
const logger = require('../logger')
const servWs = require('../services/service-ws')
const robtopUser = require('../../resources/robtop_objects/user.json')

/** @type {import('redis').RedisClientType} */
let redisObject = null

const ROBTOP_SECRET = 'Wmfd2893gb7'
const COOLDOWN_MS = 15000;

const requestQueue = [];
let isProcessingQueue = false;
let lastExecutionTime = 0;

/**
 * Enqueues an API call task to be executed sequentially with a 15-second cooldown.
 * 
 * @param {Function} task - Async function performing the request.
 * @returns {Promise<any>} A promise that resolves or rejects with the task's result once executed.
 */
function enqueueApiRequest(task) {
    return new Promise((resolve, reject) => {
        requestQueue.push({ task, resolve, reject });
        processQueue();
    });
}

/**
 * Sequentially processes items in the request queue while enforcing a 15-second delay
 * between consecutive API executions to prevent rate-limiting or IP bans from RobTop's servers.
 * 
 * @returns {Promise<void>}
 */
async function processQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (requestQueue.length > 0) {
        const { task, resolve, reject } = requestQueue.shift();

        const now = Date.now();
        const timeSinceLast = now - lastExecutionTime;
        if (lastExecutionTime > 0 && timeSinceLast < COOLDOWN_MS) {
            const waitTime = COOLDOWN_MS - timeSinceLast;
            await new Promise((r) => setTimeout(r, waitTime));
        }

        try {
            const result = await task();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            lastExecutionTime = Date.now();
        }
    }

    isProcessingQueue = false;
    if (requestQueue.length > 0) {
        processQueue();
    }
}

/**
 * Send a POST request to RobTop's getGJUserInfo20.php endpoint via the request queue.
 * 
 * @param {string} accountID - The target Geometry Dash account ID.
 * @returns {Promise<import('axios').AxiosResponse>} Resolves with the raw HTTP response object.
 */
async function getGJUserInfo20(accountID) {
    return enqueueApiRequest(() => {
        const data = new URLSearchParams({
            "secret": ROBTOP_SECRET,
            "targetAccountID": accountID
        });

        return axios.post('http://www.boomlings.com/database/getGJUserInfo20.php', data, {
            headers: {
                'User-Agent': '',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    });
}

/**
 * Send a POST request to RobTop's getGJUsers20.php endpoint via the request queue.
 * 
 * @param {string} username - The Geometry Dash username or search string.
 * @returns {Promise<import('axios').AxiosResponse>} Resolves with the raw HTTP response object.
 */
async function getGJUsers20(username) {
    return enqueueApiRequest(() => {
        const data = new URLSearchParams({
            "secret": ROBTOP_SECRET,
            "str": username
        });

        return axios.post('http://www.boomlings.com/database/getGJUsers20.php', data, {
            headers: {
                'User-Agent': '',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    });
}

/**
 * Parse a RobTop response string into a map of known user property keys and values.
 * The input is a colon-separated sequence of key/value pairs. Each key is looked up
 * in the robtopUser description table, and matching values are decoded to UTF-8 when
 * the field represents a message.
 *
 * @param {string} str - The raw response string containing colon-separated key/value pairs.
 * @returns {Map<string, string>} A map where the keys are property names and the values are parsed values.
 */
function extractKeyValuePairs(str) {
    const map = new Map();
    let key = '';
    let value = '';
    let isKey = true;

    const addProperty = () => {
        const item = robtopUser.find(item => item.key == parseInt(key));
        if (!item) {
            //logger.DBG(`extractKeyValuePairs: unknown key ${key}`)
        } else {
            if (item.value === 'message')
                value = Buffer.from(value, 'base64').toString('utf-8')
            map.set(item.value, value);
        }
    }

    for (let i = 0; i < str.length; i++) {
        if (str[i] === ':') {
            if (isKey) {
                isKey = false;
            } else {
                addProperty()
                key = ''; value = '';
                isKey = true;
            }
        } else {
            if (isKey) {
                key += str[i];
            } else {
                value += str[i];
            }
        }
    }

    addProperty()

    return map;
}

/**
 * Helper wrapper that calls an API fetching function, checks for failure responses ('-1'),
 * and parses valid raw key-value strings into a structured Map.
 * 
 * @param {string} param - The parameter (accountID or username) to pass to the API function.
 * @param {Function} func - API function to call (e.g. getGJUserInfo20 or getGJUsers20).
 * @returns {Promise<Map<string, string> | null>} A map of user properties, or null if not found.
 */
async function getUserData(param, func) {
    const response = (await func(param)).data;
    if (`${response}` === '-1') 
        return null;
    return extractKeyValuePairs(response);
}

/**
 * Fetch and parse full user information for a Geometry Dash account ID via the request queue.
 * Includes custom error handling and a 20-second request timeout.
 * 
 * @param {string} accountID - The target Geometry Dash account ID.
 * @returns {Promise<Map<string, string> | null>} Map of user info properties, or null on failure/not found.
 */
async function getUserInfo(accountID) {
    return enqueueApiRequest(async () => {
        const searchParams = new URLSearchParams({
            "secret": ROBTOP_SECRET,
            "targetAccountID": accountID
        });

        let response = null;
        try {
            /* response = await axios.post('http://www.boomlings.com/database/getGJUserInfo20.php', searchParams, {
                headers: {
                    'User-Agent': '',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 20000
            }); */

            response = await servWs.post('http://www.boomlings.com/database/getGJUserInfo20.php', searchParams, {
                headers: {
                    'User-Agent': '',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
        } catch (error) {
            if (error?.response?.status !== 429 && error?.response?.status !== 403) {
                logger.ERR('Error fetching user info:', error);
            }
        }

        if (response === null || `${response}` === '-1') 
            return null;

        return extractKeyValuePairs(response.data);
    });
}

/**
 * Fetch pending friend requests for a Geometry Dash account via the request queue.
 * 
 * Sends a POST request to RobTop's getGJFriendRequests20.php endpoint using the provided
 * account ID and encrypted password token (gjp2).
 * 
 * @param {number|string} accountID - The Geometry Dash account ID.
 * @param {string} gjp2 - The encrypted password token used for authentication.
 * @returns {Promise<string | null>} The raw server response as a string, or null if the request fails.
 */
async function getGJFriendRequests20(accountID, gjp2) {
    return enqueueApiRequest(async () => {
        const searchParams = new URLSearchParams({
            "secret": ROBTOP_SECRET,
            "accountID": accountID,
            "gjp2": gjp2
        });

        try {
            const response = await axios.post('http://www.boomlings.com/database/getGJFriendRequests20.php', searchParams, {
                headers: {
                    'User-Agent': '',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data.toString();
        } catch (error) {
            if (error?.response?.status !== 429 && error?.response?.status !== 403) {
                logger.ERR('Error fetching user info:', error);
            }
        }

        return null;
    });
}

module.exports = {
    /**
     * Set the global Redis client instance.
     * @param {import('redis').RedisClientType} redisObj - Redis client instance.
     */
    setRedisClientObject: (redisObj) => redisObject = redisObj,

    /**
     * Fetch user information for a single user by account ID.
     * @param {string} accountID - The account ID of the user to fetch information for.
     * @returns {Promise<Map<string, string> | null>} A map of user information or null if an error occurs.
     */
    getGJUserInfo20: async (accountID) => getUserData(accountID, getGJUserInfo20),

    /**
     * Fetch user information for a single user by username.
     * @param {string} username - The username of the user to fetch information for.
     * @returns {Promise<Map<string, string> | null>} A map of user information or null if an error occurs.
     */
    getGJUsers20: async (username) => getUserData(username, getGJUsers20),

    /**
     * Fetch user profile info directly by account ID with timeout and error handling.
     * @param {string} accountID - The Geometry Dash account ID.
     * @returns {Promise<Map<string, string> | null>} A map of user information or null if an error occurs.
     */
    getUserInfo,

    /**
     * Fetch pending friend requests for a Geometry Dash account.
     * @param {number|string} accountID - The Geometry Dash account ID.
     * @param {string} gjp2 - Encrypted password token used for authentication.
     * @returns {Promise<string | null>} Raw server response or null on failure.
     */
    getGJFriendRequests20,

    /**
     * Parse a raw colon-separated RobTop response string into a key-value Map.
     * @param {string} str - Raw response string containing colon-separated key/value pairs.
     * @returns {Map<string, string>} Map of parsed key-value properties.
     */
    extractKeyValuePairs
}