const { Db } = require('mongodb');
const logger = require('../../logger');
const { Client, TextChannel } = require('discord.js');
const GITHUB_TOKEN = require('../../../.botconfig/token.json').GITHUB_TOKEN;
const aredlapi = require('../../aredlapi');
const axios = require('axios');
const { COLL_GDVZLA_LIST_CONFIG } = require('../../../.botconfig/database-info.json')
const channels = require('../../../.botconfig/channels.json');

//////////////////////////////////////

/**
 * @typedef {Object} ListData
 * @property {string} sha - The SHA of the list file.
 * @property {string[]} content - The array of level names in the list.
 */

/**
 * @typedef {Object} NormalizedLevel
 * @property {string} originName - The original name of the level.
 * @property {string} name - The normalized name of the level.
 * @property {number} position - The position of the level in the list.
 */

/**
 * @typedef {Object} LastChangelog
 * @property {Object} _id - The document ID.
 * @property {aredlapi.ChangelogEntry} data - The last changelog entry.
 */

/**
 * @typedef {Object} ListChangeEvents
 * @property {string} levelName - The name of the level that changed.
 * @property {number} from - The original position of the level.
 * @property {number} to - The new position of the level.
 * @property {string|null} above - The name of the level above the new position, if any.
 * @property {string|null} below - The name of the level below the new position, if any.
 * @property {string|null} pushed - The name of the level that was pushed out of its range, if any.
 * @property {'main' | 'extended' | 'legacy' | null} pushedTarget - The target range of the pushed level, if any.
 * @property {string|null} pushed2 - The name of the level that was pushed out of its range, if any.
 * @property {'main' | 'extended' | 'legacy' | null} pushedTarget2 - The target range of the pushed level, if any.
 */

const TIME_INTERVAL = 14400000; // 4 hours

const RANK_LIMITS = {
    main: 75,
    extended: 150
};

/**
 * Determines the range of a level based on its position.
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

    const raw = JSON.parse(Buffer.from(response.data.content, "base64").toString());
    return {
        sha: response.data.sha,
        content: Array.isArray(raw) ? raw : Object.values(raw)
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

/**
 * Saves the sorted list to GitHub.
 * @param {string} sha - The SHA of the current list file.
 * @param {string[]} sortedList - The sorted list of level names.
 */
async function saveSortedList(sha, sortedList) {
    await axios.put(`https://api.github.com/repos/Abuigsito/gdvzla/contents/data/_list.json`, {
        message: `Sorted list _list.json`,
        content: Buffer.from(JSON.stringify(sortedList, null, 4)).toString('base64'),
        sha: sha,
        branch: 'main'
    }, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`
        }
    });
}

/**
 * Generates a message describing the change in level position.
 * @param {ListChangeEvents} changeEvents - The details of the level change
 * @returns {string} The generated message
 */
function generateChangeMessage(changeEvents) {
    const {
        levelName,
        from,
        to,
        above,
        below,
        pushed,
        pushedTarget,
        pushed2,
        pushedTarget2
    } = changeEvents;

    const direction = to < from ? 'subido' : 'bajado';
    const base = `**${levelName}** ha ${direction} desde el top #${from} al top #${to}`;

    let context = '';
    if (to === 1) {
        context = ', convirtiéndose en el nuevo líder de la lista';
    } else if (above && below) {
        context = `, por encima de **${below}** y por debajo de **${above}**`;
    } else if (above) {
        context = `, por debajo de **${above}**`;
    } else if (below) {
        context = `, por encima de **${below}**`;
    }

    let thrust = '';
    if (pushed) {
        thrust += `. Este cambio ha empujado a **${pushed}** hacia la ${pushedTarget} list`;
    }
    if (pushed2) {
        thrust += ` y también a **${pushed2}** hacia la ${pushedTarget2} list`;
    }

    return `${base}${context}${thrust}.`;
}

/**
 * Check if the two lists have the same length and if the order of their
 * contents is identical.
 * @param {Client} client 
 * @param {ListData} listLevels 
 * @param {NormalizedLevel[]} sortedList 
 * @returns {Promise<boolean>} true if both lists are identical (same elements in the same order), false otherwise
 */
async function isSortedList(client, listLevels, sortedList) {
    if (listLevels.content.length !== sortedList.length) {
        const channel = await client.channels.fetch(channels.SUBMITS);
        if (channel && channel.isTextBased())
            await channel.send('Ha ocurrido un error al ordenar la lista de niveles de la **GD Venezuela List**.\nPosibles causas:\n\n- Hay más de un nivel con el mismo nombre\n- Se ha eliminado un nivel\n- Error interno en la **API** de la **AREDL**');
        throw new Error('The number of levels in the GD Venezuela List does not match the number of levels fetched from the API');
    }

    for (let i = 0; i < listLevels.content.length; i++) {
        if (listLevels.content[i] !== sortedList[i].name) {
            return false;
        }
    }
    return true;
}

/**
 * Extracts events from a changelog entry related to level changes.
 * @param {aredlapi.ChangelogEntry} change - The changelog entry.
 * @param {NormalizedLevel[]} normalizedLevels - The list of normalized levels.
 * @param {ListData} oldNormalizedLevels - Data from the unsorted list (original).
 * @returns {ListChangeEvents|null} An object containing event details or null if no relevant event is found.
 */
function getEventsFromLevelChange(change, normalizedLevels, oldNormalizedLevels) {
    let levelIndex = normalizedLevels.findIndex(level => level.originName === change.affected_level.name);
    const events = {
        levelName: change.affected_level.name,
        from: oldNormalizedLevels.content.findIndex(name => name === getLevelName(change.affected_level.name)) + 1,
        to: levelIndex + 1,
        above: normalizedLevels[levelIndex - 1] ? normalizedLevels[levelIndex - 1].originName : null,
        below: normalizedLevels[levelIndex + 1] ? normalizedLevels[levelIndex + 1].originName : null,
        pushed: null,
        pushedTarget: null,
        // There is a small chance that a level will move from legacy to main or vice versa,
        // resulting in two records of levels that have changed list rank
        pushed2: null,
        pushed2Target: null
    }

    // The level that has changed range in the list due to the movement of
    // the affected level before the list normalization is extracted
    if (events.from > 75 && events.to <= 75 && events.from <= 150) {
        events.pushed = normalizedLevels.find(level => oldNormalizedLevels.content[74] == level.name).originName;
        events.pushedTarget = 'extended';
    } else if (events.from <= 75 && events.to > 75 && events.to <= 150) {
        events.pushed = normalizedLevels.find(level => oldNormalizedLevels.content[75] == level.name).originName;
        events.pushedTarget = 'main';
    } else if (events.from > 150 && events.to <= 150 && events.to > 75) {
        events.pushed = normalizedLevels.find(level => oldNormalizedLevels.content[149] == level.name).originName;
        events.pushedTarget = 'legacy';
    } else if (events.from <= 150 && events.from > 75 && events.to > 150) {
        events.pushed = normalizedLevels.find(level => oldNormalizedLevels.content[150] == level.name).originName;
        events.pushedTarget = 'extended';
    } else if (events.from > 150 && events.to <= 75) {
        events.pushed = normalizedLevels.find(level => oldNormalizedLevels.content[74] == level.name).originName;
        events.pushedTarget = 'extended';
        events.pushed2 = normalizedLevels.find(level => oldNormalizedLevels.content[149] == level.name).originName;
        events.pushed2Target = 'legacy';
    } else if (events.from <= 75 && events.to > 150) {
        events.pushed = normalizedLevels.find(level => oldNormalizedLevels.content[75] == level.name).originName;
        events.pushedTarget = 'main';
        events.pushed2 = normalizedLevels.find(level => oldNormalizedLevels.content[150] == level.name).originName;
        events.pushed2Target = 'extended';
    }

    return events
}

/**
 * Filters the changelog entries to include only those that affect levels present in the current list.
 * @param {aredlapi.ChangelogEntry[]} changelog - The full changelog entries.
 * @param {LastChangelog} doc - The last changelog document from the database.
 * @param {NormalizedLevel[]} normalizedLevels - The list of normalized levels.
 * @param {ListData} listData - Data from the unsorted list (original).
 * @returns {aredlapi.ChangelogEntry[]} The filtered changelog entries.
 */
function filterChangelogLevels(changelog, doc, normalizedLevels, listData) {
    const index = doc ? changelog.findIndex(entry => entry === doc.data) : changelog.length;
    const filteredLevels = [];
    changelog.slice(0, index).reverse().forEach(entry => {
        const levelIndex = normalizedLevels.findIndex(level => level.originName === entry.affected_level.name);
        if (levelIndex !== -1 && listData.content[levelIndex] !== normalizedLevels[levelIndex].name) {
            filteredLevels.push(entry);
        }
    });

    return filteredLevels;
}

/**
 * Prints the changelog of the GD Venezuela List.
 * @param {Db} db - The MongoDB database instance
 * @param {Client} client - The Discord client
 * @param {NormalizedLevel[]} normalizedLevels - The list sorted according to the API result
 * @param {ListData} listData - Data from the unsorted list (original)
 */
async function printChangelog(db, client, normalizedLevels, listData) {
    const changelog = await aredlapi.getChangelog();
    /** @type {LastChangelog} */
    const doc = await db.collection(COLL_GDVZLA_LIST_CONFIG).findOne({ type: 'lastChangelog' });

    if (!changelog.data || changelog.data.length === 0 || (doc && doc.data && changelog.data[0] === doc.data))
        return; // No new changelog entry

    // The first change record is saved to prevent duplicate reports, although
    // if the isSortedList function returns true, it means that there are no
    // changes in the list to report.
    await db.collection(COLL_GDVZLA_LIST_CONFIG).updateOne(
        { type: 'lastChangelog' },
        {
            $set: {
                data: changelog.data[0]
            }
        },
        { upsert: true }
    );

    const filteredChangelog = filterChangelogLevels(changelog.data, doc, normalizedLevels, listData);
    if (filteredChangelog.length === 0)
        return; // No relevant changelog entries

    const messages = [];
    for (let i = 0; i < filteredChangelog.length; i++) {
        const eventsChange = getEventsFromLevelChange(filteredChangelog[i], normalizedLevels, listData);
        if (eventsChange) {
            messages.push(generateChangeMessage(eventsChange))
        }
    }

    if (messages.length > 0) {
        const channel = await client.channels.fetch(channels.LIST_CHANGES);
        if (channel && channel.isTextBased()) {
            for (let i = 0; i < messages.length; i++) {
                const messageSend = await channel.send({ content: messages[i] }).catch(() => null);
                if (!messageSend)
                    return
                await messageSend.react('👍');
                await messageSend.react('👎');
            }
            await channel.send('<@&1376586957735465111>');
        }
    }
}

/**
 * @param {Db} db 
 * @param {Client} client 
 */
async function service(db, client) {
    const functionRun = async () => {
        try {
            if (await isListUpdatable(db)) {
                /** @type {ListData} */
                const listData = await getListLevels();
                const currentLevels = await aredlapi.getLevels();
                /** @type {NormalizedLevel[]} */
                let normalizedLevels = currentLevels.filter(level => listData.content.includes(getLevelName(level.name)))
                    .map(level => {
                        return {
                            originName: level.name,
                            name: getLevelName(level.name),
                            position: level.position
                        }
                    }).sort((a, b) => a.position - b.position);

                // If the list is sorted, it means that one or more levels
                // of the list have been moved, which means that the changes
                // will be saved directly to GitHub and notified in the
                // corresponding channel
                
                if (!await isSortedList(client, listData, normalizedLevels)) {
                    await saveSortedList(listData.sha, normalizedLevels.map(level => level.name));
                    await printChangelog(db, client, normalizedLevels, listData);
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