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

const { PermissionsBitField, GuildMember } = require("discord.js");
const { YOUTUBE_API_KEY } = require('../.botconfig/token.json')
const logger = require('./logger')
const { states } = require('../.botconfig/country-states.json');

//
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//

/**
 * 
 * @param {*} url 
 * @returns 
 */
function isValidYouTubeUrl(url) {
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    const match = url.match(regex);

    if (!match) {
        return false;
    }

    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();

    return videoId && videoId.length === 11;
}

/**
 * 
 * @param {String} url 
 * @returns {Number | null}
 */
function isValidPointercrateUrl(url) {
    if (!/^https:\/\/www\.pointercrate\.com\/demonlist\/\d+$/.test(url))
        return null;
    const parts = url.split('/')
    const number = parseInt(parts[parts.length - 1])
    if (number < 1) // The position of the level in the demonlist cannot be less than 1.
        return null;
    return number;
}

/**
 * @param {String} url
 * @returns {String} Normalized YouTube link
 * 
 * This function normalizes YouTube links to a standard format.
 * It converts various YouTube URL formats to the standard "https://www.youtube.com/watch?v=VIDEO_ID" format.
 * If the URL does not match any known YouTube format, it returns the original URL.
 */
function normalizeYoutubeLink(url) {
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\s]+\/S+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);
    
    if (match && match[1])
        return `https://www.youtube.com/watch?v=${match[1]}`;
    return url;
}

/**
 * @param {*} videoUrl 
 * @returns 
 */
async function getYouTubeThumbnail(videoUrl) {
    let videoId;
    const url = new URL(videoUrl);
    const hostname = url.hostname;

    if (hostname === 'www.youtube.com' || hostname === 'youtube.com') {
        videoId = url.searchParams.get('v');
    } else if (hostname === 'youtu.be') {
        videoId = url.pathname.split('/')[1];
    }

    if (!videoId) {
        throw new Error('Invalid YouTube URL');
    }

    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet`);
        if (!response.ok) {
            throw new Error('Failed to fetch video data')
        }

        const thumbnails = (await response.json()).items[0].snippet.thumbnails;
        return thumbnails.maxres?.url || thumbnails.standard?.url
            || thumbnails.medium?.url || thumbnails.default?.url;
    } catch (error) {
        logger.ERR(error.message)
        return 'https://media.discordapp.net/attachments/1037758697990000672/1295422400145395823/video-not-available.png';
    }
}

/**
 * @param {string} input
 * @returns {string}
 */
function escapeDiscordSpecialChars(input) {
    const specialChars = ['*', '_', '`', '~'];
    specialChars.forEach(char => {
        input = input.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
    });

    return input;
}

/**
 * @param {GuildMember} member 
 * @returns {string}
 */
function getUserFlagState(member) {
    const length = member.roles.cache.size;
    for (let i = 0; i < length; i++) {
        const role = member.roles.cache.at(i);
        if (role) {
            const state = states.find(state => state.roleId === role.id);
            if (state) {
                return state.flagUrl.substring(state.flagUrl.lastIndexOf('/') + 1, state.flagUrl.lastIndexOf('.'));
            }
        }
    }

    return null
}

/**
 * @param {GuildMember} member 
 * @returns {boolean}
 */
function hasUserPermissions(member) {
    const superUserId = '591640548490870805'; // ID of the superuser (bot developer)
    const roles = [
        '1119804656923709512', // Dictador
        '1119804806521946155', // Tribunal supremo
        '1121221914254397592'  // Ministerio
    ];

    if (member.id === superUserId || member.id === member.guild.ownerId)
        return true;
    return roles.some(role => member.roles.cache.has(role));
}


/**
 * 
 * @param {GuildMember} member 
 * @returns {boolean}
 */
function isAdministrator(member) {
    return member.permissions.has(PermissionsBitField.Flags.Administrator)
}

module.exports = {
    isValidYouTubeUrl,
    getYouTubeThumbnail,
    isAdministrator,
    isValidPointercrateUrl,
    escapeDiscordSpecialChars,
    hasUserPermissions,
    getUserFlagState,
    normalizeYoutubeLink
}