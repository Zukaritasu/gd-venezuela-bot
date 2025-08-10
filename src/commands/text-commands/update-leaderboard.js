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

/**
 * Cleans the top 15 channel by deleting the last 100 messages.
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

    ctx.font = 'bold 16px Sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const nameX = avatarX + avatarSize + 12;
    ctx.fillText(member.user.username, nameX, 8);

    ctx.font = '12px Sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`XP: ${user.xp}`, nameX, 28);

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
            const top_xp = await database.collection('config').findOne(
                {
                    type: 'top_xp'
                });

            if (!top_xp || !('usersList' in top_xp)) {
                await message.reply('The list of XP users has not been found. Try again later...');
                return;
            }

            //const channel = await message.guild.channels.fetch('1294668385950498846')
            const channel = await message.guild.channels.fetch(channels.TOP_15)
            if (!channel || !(channel instanceof GuildChannel)) {
                await message.reply('The Top 15 XP channel was not found. Try again later...');
                return;
            }

            await cleanChannelTop15(channel);
            await channel.send('**TOP 15 USUARIOS CON MAS XP DE TEXTO EN EL SERVIDOR!**\n\n:warning:  Recuerda que el **Staff** y los usuarios con rol **Notable** no forman parte del Top\nPara ganar experiencia (XP), solo tienes que participar activamente en los canales de texto del servidor enviando mensajes de __texto, emojis, stickers__, etc. Todo lo referente a los canales de texto.\n\n**Para mas información puedes usar los siguientes comandos**\n- `/utilidades top xp` Muestra el Top 15\n- `/utilidades top rank` Muestra tu posición en el Top 25 \n\n*Si sales del Top 15, el rol se mantendrá contigo hasta que llegues al Top 25; si bajas otro nivel, lamentablemente perderás el rol, así que mantente activo!!!*');

            for (let i = 0; i < top_xp.usersList.length && i < 15; i++) {
                const member = await message.guild.members.fetch(top_xp.usersList[i].id).catch(() => null);
                if (member) {
                    await sendImage(channel, member, top_xp.usersList[i], i + 1);
                }
            }

            await message.react('✅')
        } catch (error) {
            logger.ERR(error);
            try {
                await message.reply({
                    content: 'Se ha producido un error al actualizar el Top 15. ' + error.message,
                })
            } catch (e) {
                logger.ERR(e);
            }
        }
    }
}