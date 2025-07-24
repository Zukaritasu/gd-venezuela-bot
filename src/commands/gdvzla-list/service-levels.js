const { Db } = require('mongodb');
const logger = require('../../logger');
const { Client } = require('discord.js');
const GITHUB_TOKEN = require('../../../.botconfig/token.json').GITHUB_TOKEN;
const aredlapi = require('../../aredlapi');
const axios = require('axios');

const TIME_INTERVAL = 14400000; // 4 hours

/**
 * @param {string} levelName 
 * @returns {string} name formatted
 */
function getLevelName(levelName) {
    return levelName.toLowerCase().replaceAll(' ', '_').replaceAll('(', '').replaceAll(')', '');
}

/**
 * Fetches the GD Venezuela List from GitHub.
 * @returns {Promise<{sha: string, content: string[]}>} The list levels with SHA and content.
 * @throws {Error} If the request fails or the response is not successful.
 */
async function getListLevels() {
    const response = await axios.get(`https://api.github.com/repos/Abuigsito/gdvzla/contents/data/_list.json`, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`
        }
    });

    if (response.status !== 200) {
        throw new Error(`Failed to fetch GD Venezuela List: ${response.statusText}`);
    }

    return {
        sha: response.data.sha,
        content: JSON.parse(Buffer.from(response.data.content, "base64").toString())
    };
}

/**
 * @param {Db} db
 * @returns {Promise<boolean>} true if more than 24h have passed since the last update or 
 * if it does not exist; false if the time has not yet elapsed
 */
async function isListUpdatable(db) {
    const now = new Date();
    const doc = await db.collection('config').findOne({ type: 'gdvzla_list' });

    if (!doc) {
        await db.collection('config').insertOne({
            type: 'gdvzla_list',
            timeLastUpdate: now
        });
        return true;
    }

    const lastUpdate = doc.timeLastUpdate ? new Date(doc.timeLastUpdate) : null;

    if (!lastUpdate || (now - lastUpdate) >= TIME_INTERVAL) {
        await db.collection('config').updateOne(
            { type: 'gdvzla_list' },
            { $set: { timeLastUpdate: now } }
        );
        return true;
    }

    return false;
}


/**
 * @param {Db} db 
 * @param {Client} client 
 */
async function service(db, client) {
    const functionRun = async () => {
        try {
            if (await isListUpdatable(db)) {
                /** @type {{sha: string, content: string[]}} */
                const listLevels = await getListLevels();
                /** @type {{id: number, name: string}[]} */
                const currentLevels = await aredlapi.getLevels();

                const updatedLevels = currentLevels.filter(level => listLevels.content.includes(getLevelName(level.name)))
                    .map(level => getLevelName(level.name));
                const changed = [];
                for (let i = 0; i < updatedLevels.length; i++) {
                    const levelName = updatedLevels[i];
                    if (listLevels.content[i] !== levelName) {
                        changed.push({
                            level: levelName,
                            newIndex: i
                        });
                    }
                }

                if (changed.length > 0) {
                    logger.DBG('Niveles que cambiaron de posición:', JSON.stringify(changed, null, 2));
                } else {
                    logger.DBG('No hubo cambios en los niveles de la lista.');
                }
            }
        } catch (error) {
            logger.ERR(error);
        }
    }

    await functionRun();

    const timeout = setInterval(functionRun, TIME_INTERVAL);

    return {
        stop: () => clearInterval(timeout),

        description: 'Self-organizing service of levels of GD Venezuela List',
        name: 'service-levels',
        fullname: 'GD Venezuela List Service Levels'
    }
}

module.exports = {
    start: service
}