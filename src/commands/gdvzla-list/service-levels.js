const { Db } = require('mongodb');
const logger = require('../../logger');
const { Client } = require('discord.js');
const GITHUB_TOKEN = require('../../../.botconfig/token.json').GITHUB_TOKEN;
const aredlapi = require('../../aredlapi');
const axios = require('axios');
const { COLL_GDVZLA_LIST_CONFIG } = require('../../../.botconfig/database-info.json')
const channels = require('../../../.botconfig/channels.json');

//////////////////////////////////////

const TIME_INTERVAL = 14400000; // 4 hours

const RANK_LIMITS = {
    main: 75,
    extended: 150
};

/**
 * @param {number} position
 * @returns {'main' | 'extended' | 'legacy'} range
 */
function getRange(position) {
    if (position <= RANK_LIMITS.main)
        return 'main';
    if (position <= RANK_LIMITS.extended)
        return 'extended';
    return 'legacy';
}


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
    const doc = await db.collection(COLL_GDVZLA_LIST_CONFIG).findOne({ type: 'lastListUpdateQuery' });

    if (!doc) {
        await db.collection(COLL_GDVZLA_LIST_CONFIG).insertOne({
            type: 'lastListUpdateQuery',
            timeLastUpdate: now
        });
        return true;
    }

    const lastUpdate = doc.timeLastUpdate ? new Date(doc.timeLastUpdate) : null;

    if (!lastUpdate || (now - lastUpdate) >= TIME_INTERVAL) {
        await db.collection(COLL_GDVZLA_LIST_CONFIG).updateOne(
            { type: 'lastListUpdateQuery' },
            { $set: { timeLastUpdate: now } }
        );
        return true;
    }

    return false;
}

function generateChangeMessage({ name, from, to, above, below, pushed, pushedTarget }) {
    const direction = to < from ? 'subido' : 'bajado';
    const base = `**${name}** ha sido ${direction} desde el top #${from} al top #${to}`;

    let context = '';
    if (to === 1) {
        context = ', convirtiéndose en el nuevo líder de la lista';
    } else if (above && below) {
        context = ` por encima de ${above} y por debajo de ${below}`;
    } else if (below) {
        context = ` por debajo de ${below}`;
    }

    const thrust = pushed ? `. Este cambio empuja a ${pushed} a la ${pushedTarget} list` : '';

    return `${base}${context}${thrust}`;
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

                const currentLevels = await aredlapi.getLevels();

                let updatedLevels = currentLevels.filter(level => listLevels.content.includes(getLevelName(level.name)))
                    .map(level => {
                        return {
                            originName: level.name,
                            name: getLevelName(level.name),
                            position: level.position
                        }
                    }).sort((a, b) => a.position - b.position);
                if (updatedLevels.length !== listLevels.content.length) {
                    throw new Error('The number of levels in the GD Venezuela List does not match the number of levels fetched from the API');
                }

                const originalPositions = {};
                listLevels.content.forEach((name, index) => {
                    originalPositions[name] = index;
                });

                /** @type {string[]} */
                const changedLevels = [];

                updatedLevels.forEach((level, newIndex) => {
                    const oldIndex = originalPositions[level.name];
                    const delta = oldIndex - newIndex;

                    if (delta !== 0) {
                        const from = oldIndex + 1;
                        const to = newIndex + 1;
                        const oldRange = getRange(from);
                        const newRange = getRange(to);

                        const above = updatedLevels[to - 2] || null;
                        const below = updatedLevels[to] || null;

                        let pushed = null;
                        let pushedTarget = null;

                        if (oldRange !== newRange) {
                            if (newRange === 'main' && oldRange === 'extended') {
                                pushed = updatedLevels[RANK_LIMITS.main];
                                pushedTarget = 'extended';
                            } else if (newRange === 'extended' && oldRange === 'legacy') {
                                pushed = updatedLevels[RANK_LIMITS.extended];
                                pushedTarget = 'legacy';
                            } else if (newRange === 'legacy' && oldRange === 'extended') {
                                pushed = updatedLevels[RANK_LIMITS.extended - 1];
                                pushedTarget = 'extended';
                            } else if (newRange === 'extended' && oldRange === 'main') {
                                pushed = updatedLevels[RANK_LIMITS.main - 1];
                                pushedTarget = 'main';
                            }
                        }

                        if (from <= 150 || to <= 150) {
                            for (let i = 0; i < changedLevels.length; i++) {
                                if ([level.originName, above?.originName, below?.originName].filter(Boolean)
                                        .some(name => changedLevels[i].includes(name))) {
                                    return; // Avoid duplicate messages
                                }
                            }

                            changedLevels.push(generateChangeMessage({
                                name: level.originName, from, to, above: above?.originName,
                                below: below?.originName, pushed: pushed?.originName, pushedTarget
                            }));
                        }
                    }
                });

                if (changedLevels.length > 0) {
                    await axios.put(`https://api.github.com/repos/Abuigsito/gdvzla/contents/data/_list.json`, {
                    //await axios.put(`https://api.github.com/repos/Zukaritasu/gdvzla/contents/data/_list.json`, {
                        message: `Sorted list _list.json`,
                        content: Buffer.from(JSON.stringify(updatedLevels.map(level => level.name), null, 4)).toString('base64'),
                        sha: listLevels.sha,
                        branch: 'main'
                    }, {
                        headers: {
                            Authorization: `token ${GITHUB_TOKEN}`
                        }
                    });

                    /** @type {import('discord.js').TextChannel} */
                    //const channel = await client.channels.fetch(channels.BOT_TESTING);
                    const channel = await client.channels.fetch(channels.LIST_CHANGES);
                    if (!channel || !channel.isTextBased()) {
                        throw new Error('The channel to send the GD Venezuela List changes is not text-based or could not be found.');
                    }

                    for (let i = 0; i < changedLevels.length; i++) {
                        const messageSend = await channel.send(changedLevels[i]);
                        await messageSend.react('👍');
                        await messageSend.react('👎');
                    }

                    await channel.send('<@&1376586957735465111>');
                    //await channel.send('<@&1266941869120684032>');
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