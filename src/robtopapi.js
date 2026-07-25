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

const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const logger = require('./logger')

const robtopUser = require('../resources/robtop_objects/user.json')

/** @type {import('redis').RedisClientType} */
let redisObject = null

/**
 * 
 * @param {string} accountID 
 * @returns 
 */
async function getGJUserInfo20(accountID) {
    const data = new URLSearchParams({
        "secret": "Wmfd2893gb7",
        "targetAccountID": accountID
    });

    return axios.post('http://www.boomlings.com/database/getGJUserInfo20.php', data, {
        headers: {
            'User-Agent': '',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
}

/**
 * 
 * @param {string} username 
 * @returns 
 */
async function getGJUsers20(username) {
    const data = new URLSearchParams({
        "secret": "Wmfd2893gb7",
        "str": username
    });

    return axios.post('http://www.boomlings.com/database/getGJUsers20.php', data, {
        headers: {
            'User-Agent': '',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
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

async function getUserData(param, func) {
    const response = (await func(param)).data;
    if (`${response}` === '-1') 
        return null;
    return extractKeyValuePairs(response);
}

async function getUserInfo(accountID) {
    const agent = new SocksProxyAgent('socks5h://127.0.0.1:9050');
    
    const data = new URLSearchParams({
        "secret": "Wmfd2893gb7",
        "targetAccountID": accountID
    });

    let response = null;
    try {
        response = await axios.post('http://www.boomlings.com/database/getGJUserInfo20.php', data, {
            headers: {
                'User-Agent': '',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            httpsAgent: agent,
            httpAgent: agent,
            timeout: 20000
        });
    } catch (error) {
        if (error?.response?.status !== 429 && error?.response?.status !== 403) {
            logger.ERR('Error fetching user info:', error);
        }
    }

    if (response === null || `${response}` === '-1') 
        return null;

    return extractKeyValuePairs(response.data);
}

/**
 * Fetch the pending friend requests for a Geometry Dash account.
 *
 * Sends a request to the RobTop API endpoint using the provided account ID and
 * encrypted password token (gjp2). The request is routed through a local SOCKS5
 * proxy at 127.0.0.1:9050.
 *
 * @param {number} accountID - The Geometry Dash account ID.
 * @param {string} gjp2 - The encrypted password token used for authentication.
 * @returns {Promise<string | null>} The raw server response as a string, or null if the request fails.
 */
async function getGJFriendRequests20(accountID, gjp2) {
    const agent = new SocksProxyAgent('socks5h://127.0.0.1:9050');

    const data = new URLSearchParams({
        "secret": "Wmfd2893gb7",
        "accountID": accountID,
        "gjp2": gjp2
    });

    try {
        const data = await axios.post('http://www.boomlings.com/database/getGJFriendRequests20.php', data, {
            headers: {
                'User-Agent': '',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            httpsAgent: agent,
            httpAgent: agent,
        })

        return data.toString()
    } catch (error) {
        if (error?.response?.status !== 429 && error?.response?.status !== 403) {
            logger.ERR('Error fetching user info:', error);
        }
    }

    return null
}

module.exports = {
    setRedisClientObject: (redisObj) => redisObject = redisObj,

    /**
     * Fetch user information for a single user.
     * @param {string} accountID - The account ID of the user to fetch information for.
     * @returns {Promise<Map<string, string> | null>} A map of user information or null if an error occurs.
     */
    getGJUserInfo20: async (accountID) => getUserData(accountID, getGJUserInfo20),

    /**
     * Fetch user information for a single user.
     * @param {string} username - The username of the user to fetch information for.
     * @returns {Promise<Map<string, string> | null>} A map of user information or null if an error occurs.
     */
    getGJUsers20: async (username) => getUserData(username, getGJUsers20),

    getUserInfo,

    getGJFriendRequests20,

    extractKeyValuePairs
}