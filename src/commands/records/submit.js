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

const { SlashCommandBuilder, ChatInputCommandInteraction, Message } = require('discord.js');
const { states } = require('../../../.botconfig/country-states.json');
const { Db } = require('mongodb');
const utils = require('../../utils')
const logger = require('../../logger');
const aredlapi = require('../../aredlapi');

///////////////////////////////////////////////////////////

/**
 * @param {ChatInputCommandInteraction | Message} interaction 
 * @param {string} player
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
 * Normalizes a YouTube link to a standard format.
 * 
 * @param {URL} url 
 * @returns {string | null}
 */
async function normalizeYoutubeLink(url) {
    try {
        const youtubeHosts = ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'];
        if (!youtubeHosts.includes(url.hostname)) {
            return url.toString(); // Not a YouTube link, return as is
        }

        // Handle youtu.be short links
        if (url.hostname === 'youtu.be') {
            const videoId = url.pathname.slice(1).split('/')[0];
            if (videoId) {
                return `https://www.youtube.com/watch?v=${videoId}`;
            }
            return null;
        }

        // Handle /watch?v=... links
        if (url.pathname === '/watch' && url.searchParams.has('v')) {
            return `https://www.youtube.com/watch?v=${url.searchParams.get('v')}`;
        }

        // Handle /shorts/... links
        if (url.pathname.startsWith('/shorts/')) {
            const videoId = url.pathname.split('/')[2];
            if (videoId) {
                return `https://www.youtube.com/watch?v=${videoId}`;
            }
            return null;
        }

        // Handle /embed/... links
        if (url.pathname.startsWith('/embed/')) {
            const videoId = url.pathname.split('/')[2];
            if (videoId) {
                return `https://www.youtube.com/watch?v=${videoId}`;
            }
            return null;
        }

        // Optionally, handle playlist links or other formats if needed

        return null;
    } catch {
        return null;
    }
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
            return link;
        } else if (link.toLowerCase().startsWith('video:') || link.toLowerCase().startsWith('vídeo:')) {
            link = link.substring(6).trim();
            try {
                new URL(link);
                return link;
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
 * @param {*} _client 
 * @param {*} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, _database, interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const channel = await interaction.client.channels.fetch('1369858143122886769');
        if (!channel) {
            await interaction.editReply('No se ha podido encontrar el canal submits');
            return;
        }
        const player = await getPlayerName(interaction, interaction.options.getString('player'));
        if (!player) return;
        const level = interaction.options.getString('level');

        const ytvideo = await getVideoLink(interaction, interaction.options.getString('ytvideo'));
        if (!ytvideo) return;

        const comment = interaction.options.getString('comment');
        const mobile = interaction.options.getBoolean('mobile') || false;

        let stateName = null;
        const length = interaction.member.roles.cache.size;
        for (let i = 0; i < length; i++) {
            const role = interaction.member.roles.cache.at(i);
            if (role) {
                const state = states.find(state => state.roleId === role.id);
                if (state) {
                    stateName = state.flagUrl.substring(state.flagUrl.lastIndexOf('/') + 1, state.flagUrl.lastIndexOf('.'));
                    break;
                }
            }
        }

        if (!stateName) {
            await interaction.editReply('No se ha podido encontrar el estado');
            return;
        }

        const stringJson =
            `
        User ID: ${interaction.user.id}
        Level: ${level}
Video: ${ytvideo}
Comentario: ${comment ?? ""}
        \`\`\`json
{
    "user": "${player}",
    "link": "${ytvideo}",
    "percent": 100,
    "mobile": ${mobile},
    "flag": "/assets/flags/${stateName}.png"
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

        await user.send(errorMessage);
        await message.react('❌');
    } catch (e) {
        logger.ERR('Error sending DM to user:', e);
    }
}

/**
 * 
 * @param {Message} message 
 * @param {string[]} parts 
 * @returns 
 */
async function processSubmitRecord(message, parts) {
    try {
        let channel = null;
        /*if (message.author.id === '591640548490870805')
            channel = await message.client.channels.fetch('1294668385950498846');
        else*/
            channel = await message.client.channels.fetch('1369858143122886769');
        if (!channel) {
            await sendErrorDM(message, 'Error interno. No se ha podido encontrar el canal submits');
            return;
        }

        const level = await getLevelName(message, parts[0]);
        if (!level) return;
        const player = await getPlayerName(message, parts[1]);
        if (!player) return;
        const ytvideo = await getVideoLink(message, parts[2]);
        if (!ytvideo) return;

        let stateName = null;
        const length = message.member.roles.cache.size;
        for (let i = 0; i < length; i++) {
            const role = message.member.roles.cache.at(i);
            if (role) {
                const state = states.find(state => state.roleId === role.id);
                if (state) {
                    stateName = state.flagUrl.substring(state.flagUrl.lastIndexOf('/') + 1, state.flagUrl.lastIndexOf('.'));
                    break;
                }
            }
        }

        if (!stateName) {
            await sendErrorDM(message, 'No se ha podido encontrar el estado');
            return;
        }

        const stringJson =
            `
User ID: ${message.author.id}
Level: ${level}
Video: ${ytvideo}
Comentario: ${parts.length > 2 ? parts.slice(3).join(' ') : parts[3].trim()}
        \`\`\`json
{
    "user": "${player}",
    "link": "${ytvideo}",
    "percent": 100,
    "mobile": false,
    "flag": "/assets/flags/${stateName}.png"
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