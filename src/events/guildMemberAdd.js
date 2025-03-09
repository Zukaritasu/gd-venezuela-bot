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

const { Events, Client, Guild, GuildMember, AttachmentBuilder } = require('discord.js');
const logger = require('../logger')
const Canvas = require('canvas');
const path = require('path');

async function updateCache(member) {
    try {
        await member.guild.members.fetch(member.id);
        logger.INF('The cache has been updated with the new member!')
    } catch (e) {
        logger.INF(e)
    }
}

/**
 * 
 * @param {GuildMember} member 
 */
async function welcomeMessageMember(member) {
    try {
        const channel = member.guild.channels.cache.get('1119795691234017462');
        if (channel) {
            const guild = member.guild;
            const count = guild.memberCount;

            const canvas = Canvas.createCanvas(1138, 640);
            const ctx = canvas.getContext('2d');

            const background = await Canvas.loadImage(path.join(__dirname, '../../images/welcome_background_blur.png'));
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

            let avatarImage = member.user.avatarURL({ extension: 'png' }) || member.user.defaultAvatarURL;
            logger.DBG(avatarImage)

            const avatar = await Canvas.loadImage(avatarImage);

            const radius = 124;
            const x = canvas.width / 2;
            const y = canvas.height / 2 - 48;

            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius + 8, 0, Math.PI * 2, true);
            ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
            ctx.shadowBlur = 26;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x, y, radius - 12, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, x - (radius - 12), y - (radius - 12), (radius - 12) * 2, (radius - 12) * 2);
            ctx.restore();

            ctx.font = 'bold 64px MakroTrial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgb(0, 0, 0)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;
            ctx.fillText('BIENVENID@', x, y + radius + 60);

            ctx.font = '36px MakroTrial';
            ctx.fillText(member.user.username, x, y + radius + 106);

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });

            channel.send(
                {
                    content: `# Bienvenido al servidor, ${member}!\n\n***Recuerda pasarte por <#1119803609773785159> para obtener roles y acceder a los diferentes canales de este servidor***. \n\nContigo somos **${count}** miembros y esperamos que disfrutes de tu estancia en GD Venezuela!`,
                    files: [attachment]
                }
            );
        }
    } catch (e) {
        logger.ERR(e)
    }
}

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(_client, _database, member) {
        try {
            await updateCache(member);
            await welcomeMessageMember(member);
        } catch (e) {
            logger.INF(e)
        }
    },
};