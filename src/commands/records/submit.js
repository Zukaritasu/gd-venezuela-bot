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

const { SlashCommandBuilder, ChatInputCommandInteraction, Message, Client } = require('discord.js');
const { states } = require('../../../.botconfig/country-states.json');
const { Db } = require('mongodb');
const utils = require('../../utils')
const logger = require('../../logger');
const aredlapi = require('../../aredlapi');

///////////////////////////////////////////////////////////


/**
 * @param {ChatInputCommandInteraction | Message} interaction 
 * @param {Db} db 
 * @param {string} username 
 * 
 * @returns {Promise<{_id: string, userId: string, username: string, state: string} | null>} Returns the profile object if found, otherwise null.
 */
async function getProfile(interaction, db, username) {
    try {
        const result = await db.collection('profiles').findOne({ username: username })
        if (result) return result;

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
 * @returns 
 */
async function getLevelName(message, level) {
    let levelName = level.trim().toLowerCase();
    const levels = await aredlapi.getLevels();
    const matchingLevels = levels.filter(lvl => lvl.name.toLowerCase() === levelName);

    if (matchingLevels.length !== 1) {
        await sendErrorDM(message, 'El nivel proporcionado no existe o hay múltiples coincidencias. Por favor, verifica el nombre del nivel.');
        return null;
    }

    return matchingLevels[0].name;
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
            try {
                new URL(link);
                return utils.normalizeYoutubeLink(link);
            } catch {

            }
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
        await interaction.deferReply({ ephemeral: true });

        const channel = await interaction.client.channels.fetch('1369858143122886769');
        if (!channel) {
            await interaction.editReply('No se ha podido encontrar el canal submits');
            return;
        }
        const player = await getPlayerName(interaction, interaction.options.getString('player'));
        if (!player) return;
        const profile = await getProfile(interaction, database, player);
        if (!profile) return;

        const level = interaction.options.getString('level');

        const ytvideo = await getVideoLink(interaction, interaction.options.getString('ytvideo'));
        if (!ytvideo) return;

        const comment = interaction.options.getString('comment');
        const mobile = interaction.options.getBoolean('mobile') || false;

        const stringJson =
            `
User ID: ${profile.userId}
Level: ${level}
Video: ${ytvideo}
Comentario: ${comment ?? ""}
        \`\`\`json
{
    "user": "${profile.username}",
    "link": "${ytvideo}",
    "percent": 100,
    "mobile": ${mobile},
    "flag": "/assets/flags/${profile.state}.png"
}
\`\`\``;

        await channel.send(stringJson);
        await interaction.editReply('Tu progreso ha sido enviado para su revisión');
    } catch (e) {
        logger.ERR('Error in submit command:', e);
        await interaction.editReply('An unknown error has occurred');
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
        let channel = null;
        channel = await message.client.channels.fetch('1369858143122886769');
        if (!channel) {
            await sendErrorDM(message, 'Error interno. No se ha podido encontrar el canal submits');
            return;
        }

        const level = await getLevelName(message, parts[0]);
        if (!level) return;
        const player = await getPlayerName(message, parts[1]);
        if (!player) return;
        const profile = await getProfile(message, database, player);
        if (!profile) return;
        const ytvideo = await getVideoLink(message, parts[2]);
        if (!ytvideo) return;
        
        const stringJson =
            `
User ID: ${profile.userId}
Level: ${level}
Video: ${ytvideo}
Comentario: ${parts.length > 2 ? parts.slice(3).join(' ') : parts[3].trim()}
        \`\`\`json
{
    "user": "${profile.username}",
    "link": "${ytvideo}",
    "percent": 100,
    "mobile": false,
    "flag": "/assets/flags/${profile.state}.png"
}
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
        } catch (error) {

        }
    }
}

module.exports = {
    execute,
    processSubmitRecord
};