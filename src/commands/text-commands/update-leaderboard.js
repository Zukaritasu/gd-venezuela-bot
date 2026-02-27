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

const { Message, GuildChannel } = require('discord.js');
const { Db } = require('mongodb');
const Canvas = require('canvas');
const StackBlur = require('stackblur-canvas');
const logger = require('../../logger');
const channels = require('../../../.botconfig/channels.json');
const topLimits = require("../../../.botconfig/top-limits.json")
const activity = require('../leveling/activity');
const { COLL_TEXT_XP } = require("../../../.botconfig/database-info.json")

/**
 * Cleans the top 25 channel by deleting the last 100 messages.
 * @param {import('discord.js').TextChannel} channel 
 */
async function cleanChannelTop15(channel) {
    const fetched = await channel.messages.fetch({ limit: 100 });
    if (fetched.size > 0) {
        for (let i = fetched.size - 1; i >= 0; i--) {
            await fetched.at(i).delete().catch(logger.ERR);
        }
    }
}

/**
 * Extracts the dominant color from an image
 * @param {Canvas.Image} image - The image to analyze
 * @returns {string} - RGB color string
 */
function getDominantColor(image) {
    const canvas = Canvas.createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let r = 0, g = 0, b = 0;
    let pixelCount = 0;
    
    // Sample every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
        const alpha = data[i + 3];
        if (alpha > 128) { // Only count non-transparent pixels
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            pixelCount++;
        }
    }
    
    if (pixelCount === 0) return '255, 255, 255'; // Fallback to white
    
    r = Math.round(r / pixelCount);
    g = Math.round(g / pixelCount);
    b = Math.round(b / pixelCount);
    
    return `${r}, ${g}, ${b}`;
}

/**
 * Generates and sends an image with the top XP user in the specified channel.
 * 
 * @param {import('discord.js').GuildBasedChannel} channel 
 * @param {import('discord.js').GuildMember} member 
 * @param {Object} user - User data containing XP.
 * @param {number} user.xp - The XP of the user.
 */
async function sendImage(channel, member, user, position) {
    const width = 478, height = 48, radius = 6;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 128 });
    const avatarImg = await Canvas.loadImage(avatarURL);

    ctx.drawImage(avatarImg, 0, 0, width, height);

    StackBlur.canvasRGBA(canvas, 0, 0, width, height, 16);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(width - radius, 0);
    ctx.quadraticCurveTo(width, 0, width, radius);
    ctx.lineTo(width, height - radius);
    ctx.quadraticCurveTo(width, height, width - radius, height);
    ctx.lineTo(radius, height);
    ctx.quadraticCurveTo(0, height, 0, height - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.restore();

    const posStr = String(position).padStart(3, ' ');
    ctx.save();
    ctx.font = 'bold 24px Sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff';

    ctx.fillText(posStr, 6 + 32, height / 2);
    ctx.restore();

    const avatarSize = 34;
    const avatarX = 46, avatarY = (height - avatarSize) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    let roleIconImg = null;
    let roleColors = null;
    try {
        const highestRole = member.roles.cache
            .filter(role => role.icon !== null && role.icon !== undefined && role.id !== '1206788723493175346')
            .sort((a, b) => b.position - a.position)
            .first();

        if (highestRole && highestRole.icon) {
            const roleIconURL = highestRole.iconURL({ extension: 'png', size: 128 });
            roleIconImg = await Canvas.loadImage(roleIconURL);
            
            if (highestRole.color && highestRole.color !== 0) {
                roleColors = {
                    primary: highestRole.color,
                    secondary: highestRole.color
                };
            }
        } else {
            const fallbackRole = member.guild.roles.cache.get('1302401396133466246');
            if (fallbackRole && fallbackRole.icon) {
                const roleIconURL = fallbackRole.iconURL({ extension: 'png', size: 128 });
                roleIconImg = await Canvas.loadImage(roleIconURL);
                
                if (fallbackRole.color && fallbackRole.color !== 0) {
                    roleColors = {
                        primary: fallbackRole.color,
                        secondary: fallbackRole.color
                    };
                }
            }
        }
    } catch (error) {
        logger.ERR(`Error loading role icon: ${error.message}`);
    }

    if (roleIconImg) {
        const roleIconSize = 28;
        const roleIconX = width - roleIconSize - 8;
        const roleIconY = (height - roleIconSize) / 2;

        const dominantColor = getDominantColor(roleIconImg);

        ctx.save();
        ctx.shadowColor = `rgba(${dominantColor}, 0.6)`;
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.drawImage(roleIconImg, roleIconX, roleIconY, roleIconSize, roleIconSize);
        ctx.restore();
    }

    ctx.font = 'bold 16px Sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const nameX = avatarX + avatarSize + 12;
    
    if (roleColors) {
        const primaryColor = roleColors.primary;
        
        const r = (primaryColor >> 16) & 255;
        const g = (primaryColor >> 8) & 255;
        const b = primaryColor & 255;
        
        const lighterR = Math.min(255, r + 80);
        const lighterG = Math.min(255, g + 80);
        const lighterB = Math.min(255, b + 80);
        
        const darkerR = Math.max(0, r - 40);
        const darkerG = Math.max(0, g - 40);
        const darkerB = Math.max(0, b - 40);
        
        const usernameLength = member.user.username.length;
        const gradientWidth = Math.max(150, usernameLength * 8);
        
        const gradient = ctx.createLinearGradient(nameX, 8, nameX + gradientWidth, 8);
        
        const wavePattern = usernameLength > 5 ? 0.15 : 0.25;
        
        gradient.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
        gradient.addColorStop(wavePattern, `rgb(${lighterR}, ${lighterG}, ${lighterB})`);
        gradient.addColorStop(wavePattern * 2, `rgb(${darkerR}, ${darkerG}, ${darkerB})`);
        gradient.addColorStop(wavePattern * 3, `rgb(${lighterR}, ${lighterG}, ${lighterB})`);
        gradient.addColorStop(wavePattern * 4, `rgb(${r}, ${g}, ${b})`);
        gradient.addColorStop(wavePattern * 5, `rgb(${darkerR}, ${darkerG}, ${darkerB})`);
        gradient.addColorStop(wavePattern * 6, `rgb(${lighterR}, ${lighterG}, ${lighterB})`);
        gradient.addColorStop(1, `rgb(${r}, ${g}, ${b})`);
        
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = '#fff';
    }
    
    ctx.fillText(member.user.username, nameX, 8);

    ctx.font = '12px Sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`XP: ${user.points}`, nameX, 28);

    await channel.send({
        files: [{
            attachment: canvas.toBuffer(), name: 'topxp.png'
        }]
    });
}

module.exports = {
    /**
     * @param {Db} database 
     * @param {Message} message 
     * @returns {Promise<void>}
     */
    update: async (database, message) => {
        try {
            const top_xp = await activity.getTopUsersData(database, 1, 'text',topLimits.positions);
            
            if (top_xp.users.length === 0) {
                await message.reply('No text XP data available to display the leaderboard');
                return;
            }

            //const channel = await message.guild.channels.fetch('1294668385950498846')
            const channel = await message.guild.channels.fetch(channels.TEXT_XP_LEADERBOARD)
            if (!channel || !(channel instanceof GuildChannel)) {
                await message.reply(`The Top ${topLimits.positions} XP channel was not found. Try again later...`);
                return;
            }

            await cleanChannelTop15(channel);
            await channel.send(`**TOP ${topLimits.positions} USUARIOS CON MAS XP DE TEXTO EN EL SERVIDOR!**\n\nPara ganar experiencia (XP), solo tienes que participar activamente en los canales de texto del servidor enviando mensajes de __texto, emojis, stickers__, etc. Todo lo referente a los canales de texto.\n\n*Si sales del Top ${topLimits.positions}, el rol se mantendrá contigo hasta que llegues al Top ${topLimits.limit}; si bajas otro nivel, lamentablemente perderás el rol, así que mantente activo!!!\nY si logras llegar al Top 1 el rol se vuelve permanente!!!*`);

            for (let i = 0; i < top_xp.users.length && i < topLimits.positions; i++) {
                const member = await message.guild.members.fetch(top_xp.users[i].userId).catch(() => null);
                if (member) {
                    await sendImage(channel, member, top_xp.users[i], i + 1);
                }
            }

            await message.react('✅')
        } catch (error) {
            logger.ERR(error);
            try {
                await message.reply({
                    content: `Se ha producido un error al actualizar el Top ${topLimits.positions}. ` + error.message,
                })
            } catch (e) {
                logger.ERR(e);
            }
        }
    }
}