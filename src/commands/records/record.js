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

const { SlashCommandBuilder, ChatInputCommandInteraction, Message, Guild, GuildMember } = require('discord.js');
const logger = require('../../logger');
const aredlapi = require('../../aredlapi');
const path = require("path");
const GITHUB_TOKEN = require('../../../.botconfig/token.json').GITHUB_TOKEN;
const axios = require('axios');

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
        const response = await axios.get(`https://api.github.com/repos/Abuigsito/gdvzla/contents/data/${fileName}.json`, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`
            }
        });
        return {
            sha: response.data.sha,
            content: JSON.parse(Buffer.from(response.data.content, "base64").toString())
        };
    } catch (error) {
        logger.ERR(error);
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
    if (!repliedMessage || repliedMessage.author.id !== '1294111960882872341')
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
 * @returns 
 */
async function createRecordFile(message, fileName, levelName, jsonInfo, userId) {
    const levels = await aredlapi.getLevels();
    const matchingLevels = levels.filter(lvl => lvl.name === levelName)[0];
    const levelInfo = await aredlapi.getLevelInfo(matchingLevels.level_id);
    const creators = levelInfo.creators;

    const fileContent = {
        id: matchingLevels.level_id,
        name: matchingLevels.name,
        author: levelInfo.publisher.global_name,
        verifier: jsonInfo.user,
        creators: creators.map(creator => creator.global_name),
        flag: jsonInfo.flag,
        verification: jsonInfo.link,
        percentToQualify: 100,
        records: []
    }

    // Create new record file

    const fileEdited = Buffer.from(JSON.stringify(fileContent, null, 4)).toString("base64");
    await axios.put(`https://api.github.com/repos/Abuigsito/gdvzla/contents/data/${fileName}.json`, {
        message: `Created record for ${jsonInfo.user} by ${message.author.username}`,
        content: fileEdited,
        branch: 'main'
    }, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`
        }
    });

    // Add level to _list.json

    /**
     * @type {{sha: string, content: string[]}}
     */

    const listRespose = await getGitHubFile('_list');
    if (!listRespose)
        throw new Error('El archivo **_list.json** no existe en el repositorio.');

    const levelLists = listRespose.content;
    if (!levelLists.includes(fileName)) {
        let insertIndex = levelLists.length;
        const levelIndex = levels.findIndex(lvl => lvl.name === levelName);

        for (let i = 0; i < levelLists.length; i++) {
            const currentLevelName = levels.find(lvl => getFileName(lvl.name) === levelLists[i])?.name;
            if (currentLevelName) {
                const currentIndex = levels.findIndex(lvl => lvl.name === currentLevelName);
                if (levelIndex < currentIndex) {
                    insertIndex = i;
                    break;
                }
            }
        }

        levelLists.splice(insertIndex, 0, fileName);

        const fileEditedList = Buffer.from(JSON.stringify(levelLists, null, 4)).toString("base64");
        await axios.put(`https://api.github.com/repos/Abuigsito/gdvzla/contents/data/_list.json`, {
            message: `Updated _list.json by ${message.author.username}`,
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
        await axios.put(`https://api.github.com/repos/Abuigsito/gdvzla/contents/data/_playerStates.json`, {
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
    jsonInfo.mobile = isMobile;
    file.content.records.push(jsonInfo);
    const fileEdited = Buffer.from(JSON.stringify(file.content, null, 4)).toString("base64");
    await axios.put(`https://api.github.com/repos/Abuigsito/gdvzla/contents/data/${fileName}.json`, {
        message: `Added record for ${jsonInfo.user} by ${message.author.username}`,
        content: fileEdited,
        sha: file.sha,
        branch: 'main'
    }, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`
        }
    });

    await addPlayerToStateList(message, jsonInfo);
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
                const channel = await message.guild.channels.fetch('1119803120994750536'); // 🔧・bot
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
 * Maneja la aceptación o rechazo de un progreso.
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
                await createRecordFile(message, fileName, levelName, jsonInfo, userId);
                await message.reply(`El archivo **${fileName}.json** no existe, por lo que se ha creado uno nuevo.`);
            } else if (file.content.verifier === jsonInfo.user || file.content.records.some(record => record.user === jsonInfo.user)) {
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