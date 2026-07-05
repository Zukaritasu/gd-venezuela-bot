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

const { ChatInputCommandInteraction, Message, Client, TextChannel } = require('discord.js');
const { RESTJSONErrorCodes, MessageFlags } = require('discord-api-types/v10')
const { Db } = require('mongodb');
const utils = require('../../utils')
const logger = require('../../logger');
const aredlapi = require('../../aredlapi');
const channels = require('../../../.botconfig/channels.json');
const gdvzlalistapi = require('../../gdvzlalistapi');
const { COLL_GDVZLA_LIST_PROFILES } = require('../../../.botconfig/database-info.json');

/**
 * 
 * @param {Message} message 
 * @param {string} param 
 * @return {Promise<{time: string, timestamp: number, isValid: boolean}>} - Returns an object
 * containing the original time string and its equivalent in milliseconds, or null if th
 *  format is invalid.
 */
async function getLevelPlatformTime(message, param) {
    const timeStr = param.trim();
    const errorMessage = 'El formato del tiempo es inválido. Debe ser `00:00:00.000`.';

    if (!/^\d+:\d+:\d+\.\d+$/.test(timeStr)) {
        await sendErrorDM(message, errorMessage);
        return { isValid: false };
    }

    const timeParts = timeStr.split(/[:.]/);
    if (timeParts.length !== 4) {
        await sendErrorDM(message, errorMessage);
        return { isValid: false };
    }

    const [hours, minutes, seconds, milliseconds] = timeParts.map(part => parseInt(part));
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(milliseconds)) {
        await sendErrorDM(message, errorMessage);
        return { isValid: false };
    }

    const totalMilliseconds = (seconds * 1000) + milliseconds;
    return { time: timeStr, timestamp: totalMilliseconds, isValid: true };
}

/**
 * Determines if a level is considered "legacy" based on its position in the level list.
 * @param {string} levelId - The ID of the level to check.
 * @param {number | null} position - The position of the level in the list.
 * @param {boolean} isPlatformer - Whether the level is a platformer level.
 * @returns {Promise<boolean>} - Returns true if the level is legacy, false otherwise.
 */
async function isLegacyLevel(levelId, position, isPlatformer) {
    const levelList = await gdvzlalistapi.getLevelListIDs(isPlatformer ? 'PLATFORMER' : 'CLASSIC');

    if (levelList.length < 150 || levelList[149] === levelId) {
        return false
    }

    const listLevels = isPlatformer ? await aredlapi.getLevelsPlatformer() : await aredlapi.getLevels();
    const lastLevelId = levelList[149]
    const lastLevelPosition = listLevels.find(lvl => `${lvl.level_id}` === lastLevelId)?.position;
    
    if (lastLevelPosition === undefined) {
        throw new Error(`Could not find position for level ID ${lastLevelId}`);
    }

    if (!position) {
        position = listLevels.find(lvl => `${lvl.level_id}` === levelId)?.position;
        if (position === undefined) {
            throw new Error(`Could not find position for level ID ${levelId}`);
        }
    }

    return position > lastLevelPosition;
}

/**
 * @param {ChatInputCommandInteraction | Message} interaction 
 * @param {Db} db 
 * @param {string} username 
 * 
 * @returns {Promise<{_id: string, userId: string, username: string, state: string} | null>} - Returns
 * the profile object if found, otherwise null.
 */
async function getProfile(interaction, db, username) {
    try {
        const profile = await db.collection(COLL_GDVZLA_LIST_PROFILES).findOne({ username: username })
        if (profile) return profile;

        if (interaction instanceof Message)
            await sendErrorDM(interaction, 'Usuario no encontrado. Verifica e intenta nuevamente. Si el usuario no existe, puedes crear uno con el comando `/records perfil crear`.');
        else if (interaction instanceof ChatInputCommandInteraction)
            await interaction.editReply('Usuario no encontrado. Verifica e intenta nuevamente. Si el usuario no existe, puedes crear uno con el comando `/records perfil crear`.');
        return null;
    } catch (error) {
        logger.ERR('Error fetching profile:', error);
        try {
            if (interaction instanceof Message)
                await sendErrorDM(interaction, 'Ha ocurrido un error al intentar obtener el perfil del usuario.');
            else if (interaction instanceof ChatInputCommandInteraction)
                await interaction.editReply('Ha ocurrido un error al intentar obtener el perfil del usuario.');
        } catch {

        }
        return null;
    }
}

/**
 * @param {ChatInputCommandInteraction | Message} interaction 
 * @param {string} player username
 */
async function getPlayerName(interaction, player) {
    const playerPart = player.trim();

    if (interaction instanceof ChatInputCommandInteraction) {
        if (playerPart.length !== 0) {
            return playerPart;
        }
    } else if (playerPart.toLowerCase().startsWith('name:')) {
        const name = playerPart.substring(5).trim();
        if (name.length != 0) {
            return name;
        }
    }

    if (interaction instanceof Message)
        await sendErrorDM(interaction, 'El formato del nombre del jugador es inválido. Debe ser "name: tu nombre".');
    else if (interaction instanceof ChatInputCommandInteraction)
        await interaction.editReply('El formato del nombre del jugador es inválido. Debe ser "name: tu nombre".');
    return null;
}

/**
 * @param {Message} message 
 * @param {string} level 
 * @returns {Promise<{name: string, levelId: number, isPlatformer: boolean, position: number} | null>} Returns the level
 * object if found, otherwise null.
 */
async function getLevelName(message, level) {
    let levelName = level.trim().toLowerCase();
    const [levels, levelsPlat] = await Promise.all([
        aredlapi.getLevels(),
        aredlapi.getLevelsPlatformer()
    ]);
    
    levels.push(...levelsPlat);

    let matchLevel = null

    if (/^\d+$/.test(levelName)) { // is level id?
        matchLevel = levels.find(lvl => `${lvl.level_id}` === levelName);
        if (!matchLevel) {
            await sendErrorDM(message, 'El ID del nivel no es válido.');
            return null;
        }
    } else {
        const matchingLevels = levels.filter(lvl => lvl.name.toLowerCase() === levelName);
        if (matchingLevels.length !== 1) {
            await sendErrorDM(message, 'El nivel proporcionado no existe o hay varias coincidencias. Por favor, comprueba el nombre del nivel o, en su lugar, introduce el ID del nivel.');
            return null;
        }

        matchLevel = matchingLevels[0]
    }

    if (!('isPlatformer' in matchLevel)) {
        matchLevel['isPlatformer'] = false
    }

    return {
        name: matchLevel.name,
        levelId: matchLevel.level_id,
        isPlatformer: matchLevel.isPlatformer,
        position: matchLevel.position
    };
}

/**
 * @param {ChatInputCommandInteraction | Message} interaction 
 * @param {string} videoLink 
 * @returns 
 */
async function getVideoLink(interaction, videoLink) {
    let link = videoLink.trim();
    try {
        if (interaction instanceof ChatInputCommandInteraction) {
            new URL(link);
            return utils.normalizeYoutubeLink(link);
        } else if (link.toLowerCase().startsWith('video:') || link.toLowerCase().startsWith('vídeo:')) {
            link = link.substring(6).trim();
            new URL(link);
            return utils.normalizeYoutubeLink(link);
        }
    } catch {

    }

    if (interaction instanceof Message)
        await sendErrorDM(interaction, 'El formato del enlace del video es inválido. Debe ser "video: tu enlace".');
    else if (interaction instanceof ChatInputCommandInteraction)
        await interaction.editReply('El formato del enlace del video es inválido. Debe ser "video: tu enlace".');
    return null;
}

/**
 * 
 * @param {Client} _client 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, database, interaction) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const player = await getPlayerName(interaction, interaction.options.getString('player'));
        if (!player) return;
        const profile = await getProfile(interaction, database, player);
        if (!profile) return;

        const level = interaction.options.getString('level');
        const [levelName, levelId] = level.split('~')

        const recordTime = interaction.options.getString('time');
        let time = null;
        if (recordTime) {
            time = await getLevelPlatformTime(interaction, recordTime);
            if (!time.isValid) {
                return;
            }
        }

        if (time) {
            const levelsPlat = await aredlapi.getLevelsPlatformer();
            if (!levelsPlat.some(lvl => lvl.name.toLowerCase() === levelName.trim().toLowerCase())) {
                await sendErrorDM(interaction, 'El nivel proporcionado no es un nivel de platformer.');
                return;
            }
        }

        if (await isLegacyLevel(levelId, null, !!time)) {
            await sendErrorDM(interaction, 'El nivel proporcionado es un nivel legacy y no se aceptan records de niveles legacy.');
            return;
        }

        const ytvideo = await getVideoLink(interaction, interaction.options.getString('ytvideo'));
        if (!ytvideo) return;

        const comment = interaction.options.getString('comment');
        const mobile = interaction.options.getBoolean('mobile') || false;

        let recordObject = {
            user: profile.username,
            link: ytvideo,
            percent: 100,
            mobile: mobile,
            flag: `/assets/flags/${profile.state}.png`
        }

        let channel = null;
        if (time) { 
            // platformer records are sent to a different channel and have a different format, 
            // so we only add the time if it's a platformer record
            channel = await interaction.client.channels.fetch(channels.PL_SUBMITS);
            recordObject.time = time.time;
            recordObject.timestamp = time.timestamp;
        } else {
            channel = await interaction.client.channels.fetch(channels.SUBMITS);
        }

        if (!channel) {
            await interaction.editReply('No se ha podido encontrar el canal submits');
            return;
        }

        const stringJson =
            `
User ID: ${profile.userId}
Level: ${levelName}
Level ID: ${levelId}
Video: ${ytvideo}
Comentario: ${comment ?? ""}
        \`\`\`json
${JSON.stringify(recordObject, null, 4)}
\`\`\``;

        await channel.send(stringJson);
        await interaction.editReply('Tu progreso ha sido enviado para su revisión');
    } catch (e) {
        logger.ERR('Error in submit command:', e);
        try {
            await interaction.editReply('An unknown error has occurred');
        } catch (error) {
            
        }
    }
}

/**
 * Sends an error message to the user via DM if they provided incorrect data.
 * If the DM cannot be sent, reacts to the user's message with ❌.
 *
 * @param {Message} message 
 * @param {string} errorMessage 
 */
async function sendErrorDM(message, errorMessage) {
    try {
        const user = message.author;
        if (!user) {
            logger.WAR('Could not fetch user to send DM');
            return;
        }

        try {
            await user.send(errorMessage);
        } catch (error) {
            if (error.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser) {
                try {
                    await message.guild.channels.cache.get(channels.BOT)?.send(`<@${user.id}> ${errorMessage}`);
                } catch (error) {
                    logger.ERR('Error sending error message to bot channel:', error);
                }
            }
        }
        await message.react('❌');
    } catch (e) {
        logger.ERR('Error sending DM to user:', e);
    }
}

/**
 * @param {Db} database 
 * @param {Message} message 
 * @param {string[]} parts 
 * @returns 
 */
async function processSubmitRecord(database, message, parts) {
    try {
        let indexPart = 0;

        const level = await getLevelName(message, parts[indexPart++]);
        if (!level) return;
        
        /** @type {{time: string, timestamp: number, isValid: boolean} | null} */
        let time = null;
        if (level.isPlatformer) {
            time = await getLevelPlatformTime(message, parts[indexPart++]);
            if (!time.isValid) {
                return;
            }
        }

        if (await isLegacyLevel(level.levelId, level.position, level.isPlatformer)) {
            await sendErrorDM(message, 'El nivel proporcionado es un nivel legacy y no se aceptan records de niveles legacy.');
            return;
        }

        const player = await getPlayerName(message, parts[indexPart++]);
        if (!player) return;
        const profile = await getProfile(message, database, player);
        if (!profile) return;
        const ytvideo = await getVideoLink(message, parts[indexPart]);
        if (!ytvideo) return;

        let recordObject = {
            user: profile.username,
            link: ytvideo,
            percent: 100,
            mobile: false,
            flag: `/assets/flags/${profile.state}.png`
        }

        let channel = null;
        if (time) {
            // platformer records are sent to a different channel and have a different format,
            // so we only add the time if it's a platformer record
            channel = await message.client.channels.fetch(channels.PL_SUBMITS);
            recordObject.time = time.time;
            recordObject.timestamp = time.timestamp;
        } else {
            channel = await message.client.channels.fetch(channels.SUBMITS);
        }
        if (!channel) {
            await sendErrorDM(message, 'No se ha podido encontrar el canal submits');
            return;
        }

        const stringJson =
            `
User ID: ${profile.userId}
Level: ${level.name}
Level ID: ${level.levelId}
Video: ${ytvideo}
Comentario: ${parts.length > indexPart ? parts.slice(++indexPart).join(' ') : parts[indexPart].trim()}
        \`\`\`json
${JSON.stringify(recordObject, null, 4)}
\`\`\``;

        await channel.send(stringJson);
        const existingReaction = message.reactions.cache.get('❌');
        if (existingReaction)
            await existingReaction.users.remove(message.client.user.id);
        await message.react('✅');
    } catch (e) {
        logger.ERR('Error in processSubmitRecord:', e);
        try {
            message.reply('An unknown error has occurred');
        } catch {

        }
    }
}

/**
 * 
 * @param {Client} client 
 * @param {Db} database 
 * @returns 
 */
async function checkNewSubmitRecords(client, database) {
    try {
        /** @type {TextChannel} */
        const channel = await client.channels.fetch(channels.SEND_RECORD);
        if (!channel) {
            throw new Error('Could not find SEND_RECORD channel');
        }

        let lastMessageId = undefined;
        while (true) {
            const fetched = await channel.messages.fetch({ limit: 1, ...(lastMessageId && { before: lastMessageId }) });
            if (fetched.size === 0) break;

            const message = fetched.first();
            lastMessageId = message.id;

            if (message.author.bot || message.reactions.cache.has('✅') || message.reactions.cache.has('❌'))
                break;
            const parts = message.content.split('\n').map(part => part.trim()).filter(part => part.length > 0);
            if (parts.length < 3) {
                await sendErrorDM(message, 'El formato del mensaje es inválido. Debe contener al menos:\nNombre o ID del nivel\nname: tu nombre\nvideo: tu enlace\n[Comentario opcional]');
                continue;
            }

            await processSubmitRecord(database, message, parts);
        }

    } catch (e) {
        logger.ERR('Error fetching new messages:', e);
    }
}


module.exports = {
    execute,
    processSubmitRecord,
    checkNewSubmitRecords
};