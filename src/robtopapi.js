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

const robtopUser = require('../resources/robtop_objects/user.json')

/**
 * 
 * @param {*} accountID 
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
 * @param {string} str 
 * @returns {Map<string, string>}
 */
function extractKeyValuePairs(str) {
    const map = new Map();
    let key = '';
    let value = '';
    let isKey = true;

    const addProperty = () => {
        const item = robtopUser.find(item => item.key == parseInt(key));
        if (item.value === 'message')
            value = Buffer.from(value, 'base64').toString('utf-8')
        map.set(item.value, value);
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
 * 
 * @param {*} accountID 
 * @returns {Map<string, string> | null}
 */
async function dataToUserObject(accountID) {
    const response = (await getGJUserInfo20(accountID)).data
    if (`${response}` === '-1')
        return null
    return extractKeyValuePairs(response)
}

module.exports = {
    getGJUserInfo20: async (accountID) => dataToUserObject(accountID)
}