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

//
//============================================================================
//

/** @type {import('redis').RedisClientType} */
let redisObject = null

/**
 * 
 * @param {*} url 
 * @returns 
 */
async function getResponseJSON(url) {
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
            const response = await redisObject.get(key)
            if (response)
                return resolve(JSON.parse(response));
            https.get(options, res => {
                let data = [];
                res.on('error', error => {
                    resolve(error);
                });
                res.on('data', chunk => { data.push(chunk); });
                res.on('end', async () => {
                    try {
                        const jsonResponseData = JSON.parse(Buffer.concat(data).toString())
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
    /**
     * 
     * @returns {Promise<{id: number, name: string}[]>}
     */
    getLevels: () => getResponseJSON('api/aredl/levels'),
    getLevelCreators: (level_id) => getResponseJSON(`v2/api/aredl/levels/${level_id}/creators`),
    getLevel: (level_id) => getResponseJSON(`v2/api/aredl/levels/${level_id}`),
    getLevelInfo: (level_id) => getResponseJSON(`api/aredl/levels/${level_id}?two_player=false&records=false&creators=true&verification=false&packs=false`),
}