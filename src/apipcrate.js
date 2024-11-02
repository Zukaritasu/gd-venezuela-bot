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

const https = require('https');

//
//============================================================================
//

/**
 * 
 * @param {*} url 
 * @returns 
 */
async function getResponseJSON(url) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'www.pointercrate.com',
            path: `/${url}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Edg/130.0.0.0',
                'upgrade-insecure-requests': 1
            }
        };

        https.get(options, res => {
            let data = [];
            res.on('error', error => {
                resolve(error);
            });
            res.on('data', chunk => { data.push(chunk); });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(data).toString()));
                } catch (error) {
                    resolve(error);
                }
            });
        });
    });
}

/**
 * 
 * @param {*} id 
 */
async function getPlayerExtraInfo(id) {
    const response = await getResponseJSON(`api/v1/players/${id}`)
    if (response instanceof Error)
        return response

    let playerInfo = response.data

    const extraData = await getResponseJSON(`api/v1/players/ranking/?name_contains=${encodeURIComponent(playerInfo.name)}`)
    if (extraData instanceof Error)
        return extraData

    try {
        playerInfo['rank'] = extraData[0].rank
    } catch (error) {
        return error
    }

    return playerInfo
}

/**
 * 
 * @param {object} params 
 * @returns string
 */
function getNumberDemonsByCategory(records) {
    let mainCount = 0;
    let extendedCount = 0;
    let legacyCount = 0;

    records.forEach(record => {
        const position = record.demon.position;

        if (record.progress === 100) {
            if (position <= 75) {
                mainCount++;
            } else if (position <= 150) {
                extendedCount++;
            } else {
                legacyCount++;
            }
        }
    });

    return `${mainCount} Main, ${extendedCount} Extended, ${legacyCount} Legacy`;
}

//
//============================================================================
//

module.exports = {
    getDemon: (id) => getResponseJSON(`api/v2/demons/${id}`),
    getCountryLeaderboard: (code) => getResponseJSON(`api/v1/players?nation=${code}`),
    getPlayerInfo: (id) => getResponseJSON(`api/v1/players/${id}`),
    /** */
    getPlayerExtraInfo,
    utils: {
        getNumberDemonsByCategory
    }
}