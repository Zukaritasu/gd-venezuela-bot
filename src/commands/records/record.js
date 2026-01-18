/**
 * Copyright (C) 2025 Zukaritasu
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

const { SlashCommandBuilder, ChatInputCommandInteraction, Message, Guild, GuildMember, TextChannel } = require('discord.js');
const logger = require('../../logger');
const aredlapi = require('../../aredlapi');
const path = require("path");
const GITHUB_TOKEN = require('../../../.botconfig/token.json').GITHUB_TOKEN;
const axios = require('axios');
const channels = require('../../../.botconfig/channels.json');

//
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//

/**
 * @param {string} levelName 
 * @returns {string} The formatted file name.
 */
function getFileName(levelName) {
    return levelName.toLowerCase().replaceAll(' ', '_').replaceAll('(', '').replaceAll(')', '');
}

/**
 * Retrieves a JSON file from the GitHub repository and parses its content.
 * Uses the GitHub API to fetch the file by name from the 'data' directory.
 * Returns the file's SHA and parsed JSON content.
 * Throws an error if the file does not exist or if another error occurs.
 * @param {string} fileName - The name of the file (without extension) to retrieve.
 * @returns {Promise<{sha: string, content: object} | null>} The file's SHA and parsed content.
 */
async function getGitHubFile(fileName) {
    try {
        const response = await axios.get(`https://api.github.com/repos/Abuigsito/gdvzla/contents/public/data/${fileName}.json`, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`
            }
        });
        return {
            sha: response.data.sha,
            content: JSON.parse(Buffer.from(response.data.content, "base64").toString())
        };
    } catch (error) {
        logger.ERR(`getGitHubFile: ${error.message}`);
        if (!(error.response && error.response.status === 404)) {
            throw new Error(`Error al obtener el archivo de GitHub: ${error.message}`);
        } else {
            //throw new Error(`El archivo **${fileName}.json** no existe en el repositorio.`);
            return null; /* no exists */
        }
    }
}

/**
 * @param {Message} message 
 */
async function getBotMessage(message) {
    if (!message.reference || !message.reference.messageId)
        return null;

    const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
    if (!repliedMessage || repliedMessage.author.id !== process.env.BOT_ID)
        return null;

    let userId = null, levelName = null;

    const content = repliedMessage.content;
    content.split('\n').forEach(line => {
        line = line.trim();
        if (line.startsWith('User ID:')) {
            userId = line.split(':')[1].trim();
        } else if (line.startsWith('Level:')) {
            levelName = line.split(':')[1].trim();
        }
    });

    if (userId && levelName) {
        return {
            userId,
            levelName,
            botRecord: repliedMessage,
            jsonInfo: JSON.parse(content.substring(content.indexOf('```json') + 7,
                content.indexOf('```', content.indexOf('```json') + 7)).trim())
        };
    }

    return null;
}

/**
 * @param {Message} message 
 * @param {string} fileName 
 * @param {string} levelName 
 * @param {Object} jsonInfo 
 * @param {string} userId 
 * @returns {Promise<{levelNameUp: string|null, levelNameDown: string|null, levelInserted: string|null, 
 * indexInserted: number, levelLegacy: string|null, levelExtended: string|null}>}
 */
async function createRecordFile(message, fileName, levelName, jsonInfo, userId) {
    const [levels, levelsPlat] = await Promise.all([
        aredlapi.getLevels(),
        aredlapi.getLevelsPlatformer()
    ]);

    let isPlatformer = false;
    let matchingLevel = levels.find(lvl => lvl.name === levelName);
    if (!matchingLevel) {
        matchingLevel = levelsPlat.find(lvl => lvl.name === levelName);
        if (!matchingLevel)
            throw new Error(`The level **${levelName}** does not exist in AREDL`);
        isPlatformer = true;
    }

    const levelInfo = isPlatformer ? await aredlapi.getLevelPlatformerInfo(matchingLevel.level_id)
        : await aredlapi.getLevelInfo(matchingLevel.level_id);
    const creators = levelInfo.creators;

    const fileContent = {
        id: matchingLevel.level_id,
        name: matchingLevel.name,
        author: levelInfo.publisher.global_name,
        verifier: jsonInfo.user,
        creators: creators.map(creator => creator.global_name),
        flag: jsonInfo.flag,
        verification: jsonInfo.link,
        percentToQualify: 100,
        records: []
    }

    let changes = {
        levelNameUp: null,
        levelNameDown: null,
        levelInserted: null,
        indexInserted: -1,
        levelLegacy: null,
        levelExtended: null
    }

    // Create new record file

    const fileEdited = Buffer.from(JSON.stringify(fileContent, null, 4)).toString("base64");
    await axios.put(`https://api.github.com/repos/Abuigsito/gdvzla/contents/public/data/${fileName}.json`, {
        message: `Created record for ${jsonInfo.user} by ${message.author.username}`,
        content: fileEdited,
        branch: 'main'
    }, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`
        }
    });

    // Add level to _list.json or _list-plat.json

    /**
     * @type {{sha: string, content: string[]}}
     */

    const fileNameList = isPlatformer ? '_list-plat' : '_list';
    const listRespose = await getGitHubFile(fileNameList);
    if (!listRespose)
        throw new Error(`El archivo **${fileNameList}.json** no existe en el repositorio.`);

    const levelLists = listRespose.content;
    const currentLevels = isPlatformer ? levelsPlat : levels;
    if (!levelLists.includes(fileName)) {
        let insertIndex = levelLists.length;
        const levelIndex = currentLevels.findIndex(lvl => lvl.name === levelName);

        for (let i = 0; i < levelLists.length; i++) {
            const currentLevelName = currentLevels.find(lvl => getFileName(lvl.name) === levelLists[i])?.name;
            if (currentLevelName) {
                const currentIndex = currentLevels.findIndex(lvl => lvl.name === currentLevelName);
                if (levelIndex < currentIndex) {
                    insertIndex = i;
                    break;
                }
            }
        }

        levelLists.splice(insertIndex, 0, fileName);

        changes.levelInserted = levelName;
        changes.indexInserted = insertIndex;

        if (insertIndex - 1 >= 0)
            changes.levelNameUp =
                currentLevels.find(lvl => getFileName(lvl.name) === levelLists[insertIndex - 1])?.name || null;
        if (insertIndex + 1 < levelLists.length)
            changes.levelNameDown =
                currentLevels.find(lvl => getFileName(lvl.name) === levelLists[insertIndex + 1])?.name || null;
        if (levelLists.length > 150)
            changes.levelLegacy =
                currentLevels.find(lvl => getFileName(lvl.name) === levelLists[150])?.name || null;
        if (insertIndex < 75)
            changes.levelExtended =
                currentLevels.find(lvl => getFileName(lvl.name) === levelLists[75])?.name || null;

        const fileEditedList = Buffer.from(JSON.stringify(levelLists, null, 4)).toString("base64");
        await axios.put(`https://api.github.com/repos/Abuigsito/gdvzla/contents/public/data/${fileNameList}.json`, {
            message: `Updated ${fileNameList}.json by ${message.author.username}`,
            content: fileEditedList,
            sha: listRespose.sha,
            branch: 'main'
        }, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`
            }
        });
    }

    // Add the user to the _playerStates.json file

    await addPlayerToStateList(message, jsonInfo);

    return {changes: changes, isPlatformer: isPlatformer};
}

/**
 * Prints the changes made to the record file.
 * @param {{levelNameUp: string|null, levelNameDown: string|null, levelInserted: string|null, indexInserted: number, 
 * levelLegacy: string|null, levelExtended: string|null}} changes
 * - The changes made to the record file.
 * @param {Guild} guild - The Discord guild where the changes occurred.
 * @returns {Promise<void>}
 */
async function printChanges(changes, guild, isPlatformer) {
    let message = isPlatformer ? `*(Platformer)* ` : ``;
    message += `**${changes.levelInserted}** ha sido agregado al top #${changes.indexInserted + 1}`;

    if (changes.levelNameDown && changes.levelNameUp) {
        message += `, por encima de **${changes.levelNameDown}** y por debajo de **${changes.levelNameUp}**.`;
    } else if (changes.levelNameDown) {
        message += `, por encima de **${changes.levelNameDown}**.`;
    } else if (changes.levelNameUp) {
        message += `, por debajo de **${changes.levelNameUp}**.`;
    } else {
        message += `.`;
    }

    if (changes.levelExtended && changes.levelLegacy) {
        message += `\nEste cambio empuja a **${changes.levelExtended}** a la extended list y a **${changes.levelLegacy}** a la legacy list.`;
    } else if (changes.levelLegacy) {
        message += `\nEste cambio empuja a **${changes.levelLegacy}** a la legacy list.`;
    } else if (changes.levelExtended) {
        message += `\nEste cambio empuja a **${changes.levelExtended}** a la extended list.`;
    }

    /** @type {TextChannel} */
    const channel = await guild.channels.fetch(channels.LIST_CHANGES); // lista-cambios
    if (!channel) {
        logger.ERR('The lista-cambios channel does not exist.');
        return;
    }

    const messageSent = await channel.send(message);
    await messageSent.react('👍');
    await messageSent.react('👎');

    await channel.send('<@&1376586957735465111>') // Notificaciones Lista
}

/**
 * @param {Message} message 
 * @param {object} jsonInfo 
 */
async function addPlayerToStateList(message, jsonInfo) {
    /**
     * @type {{sha: string, content: {player: string, estado: string}[]}}
     */
    const playerListResponse = await getGitHubFile('_playerStates');
    if (!playerListResponse)
        throw new Error('El archivo **_playerStates.json** no existe en el repositorio.');

    const player = playerListResponse.content.find(player => player.player === jsonInfo.user);
    if (!player) {
        playerListResponse.content.push({
            player: jsonInfo.user,
            // estado is the url of the flag, example: /assets/flags/miranda.png
            estado: path.basename(jsonInfo.flag, path.extname(jsonInfo.flag)),
        });

        const fileEditedPlayer = Buffer.from(JSON.stringify(playerListResponse.content, null, 4)).toString("base64");
        await axios.put(`https://api.github.com/repos/Abuigsito/gdvzla/contents/public/data/_playerStates.json`, {
            message: `Updated _playerStates.json by ${message.author.username}`,
            content: fileEditedPlayer,
            sha: playerListResponse.sha,
            branch: 'main'
        }, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`
            }
        });
    }
}

/**
 * @param {object} file 
 * @param {object} jsonInfo 
 * @param {string} fileName
 */
async function addRecord(message, file, jsonInfo, fileName, isMobile) {
    const oldRecord = file.content.records.find(record => record.user === jsonInfo.user);
    if (oldRecord) {
        if (jsonInfo.percent <= oldRecord.percent) {
            throw new Error(`El usuario **${jsonInfo.user}** ya tiene un progreso mayor o igual aceptado (${oldRecord.percent}%)`);
        }

        oldRecord.percent = jsonInfo.percent;
        oldRecord.link = jsonInfo.link;
        oldRecord.mobile = isMobile;
    } else {
        jsonInfo.mobile = isMobile;
        file.content.records.push(jsonInfo);
    }

    const fileEdited = Buffer.from(JSON.stringify(file.content, null, 4)).toString("base64");
    await axios.put(`https://api.github.com/repos/Abuigsito/gdvzla/contents/public/data/${fileName}.json`, {
        message: `Added record for ${jsonInfo.user} by ${message.author.username}`,
        content: fileEdited,
        sha: file.sha,
        branch: 'main'
    }, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`
        }
    });

    if (!oldRecord) {
        await addPlayerToStateList(message, jsonInfo);
    }
}

/**
 * @param {Message} message 
 * @param {GuildMember} member 
 * @param {string} content 
 */
async function sendMessageToUser(message, member, content) {
    try {
        await member.send(content);
    } catch (error) {
        try {
            if (error.message === 'Cannot send messages to this user') {
                await message.react('📧');
                const channel = await message.guild.channels.fetch(channels.BOT); // 🔧・bot
                if (!channel)
                    return await message.reply('No se ha podido enviar el mensaje al usuario. El canal de bots no existe.');
                await channel.send(`<@${member.user.id}> ${content}`);
            } else {
                await message.reply(`No se ha podido enviar el mensaje al usuario: ${error.message}`);
                throw error; // Re-throw the error to be handled by the caller
            }
        } catch (err) {
            logger.ERR(err);
        }
    }
}

/**
 * 
 * @param {Message} message 
 * @param {boolean} isAccept 
 */
async function handleProgress(message, isAccept) {
    try {
        const botMessage = await getBotMessage(message);
        if (!botMessage) return;

        const { userId, levelName, botRecord, jsonInfo } = botMessage;
        const user = await message.guild.members.fetch(userId);
        if (!user) return await message.react('❌');

        if (isAccept) {
            const fileName = getFileName(levelName);
            let file = await getGitHubFile(fileName);
            if (!file) { // File doesn't exist, create it
                const report = await createRecordFile(message, fileName, levelName, jsonInfo, userId);
                await message.reply(`El archivo **${fileName}.json** no existe, por lo que se ha creado uno nuevo.`);
                await printChanges(report.changes, message.guild, report.isPlatformer);
            } else if (file.content.verifier === jsonInfo.user ||
                file.content.records.some(record => record.user === jsonInfo.user && record.percent >= 100)) {
                await botRecord.react('✅');
                await message.react('⚠️');
                return await message.reply('El progreso ya ha sido aceptado anteriormente.');
            } else {
                const parts = message.content.split(' ');
                let isMobile = false;
                if (parts.length === 2) {
                    const variable = parts[1].trim().toLowerCase();
                    if (variable === 'mobile') {
                        isMobile = true
                    }
                }

                await addRecord(message, file, jsonInfo, fileName, isMobile)
            }

            await sendMessageToUser(message, user, `Tu progreso en el nivel **${levelName}** ha sido aceptado :white_check_mark:. ¡Felicidades!`);
            await botRecord.react('✅');

        } else {
            await sendMessageToUser(message, user, `Tu progreso en el nivel **${levelName}** ha sido rechazado :x:\n**Razón:** ${message.content.substring(11).trim()}`);
            await botRecord.react('❌');
        }
        await message.react('✅');
    } catch (error) {
        logger.ERR(error);
        try {
            await message.reply(`Error al ${isAccept ? 'aceptar' : 'rechazar'} el record: ${error.message}`);
            await message.react('❌');
        } catch {

        }
    }
}

/**
 * @param {Message} message 
 */
async function accept(message) {
    await handleProgress(message, true);
}

/**
 * @param {Message} message 
 */
async function decline(message) {
    await handleProgress(message, false);
}

module.exports = {
    accept,
    decline
}