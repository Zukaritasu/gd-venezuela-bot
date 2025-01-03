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
 * 
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

    const maxresUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    const sdUrl = `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;

    try {
        const response = await fetch(maxresUrl);
        if (response.ok) {
            return maxresUrl;
        } else {
            return sdUrl;
        }
    } catch (error) {
        return sdUrl;
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
    hasUserPermissions
}