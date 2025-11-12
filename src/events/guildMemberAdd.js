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

const { Events, Client, GuildMember, AttachmentBuilder } = require('discord.js');
const logger = require('../logger')
const Canvas = require('canvas');
const path = require('path');
const { Db } = require('mongodb');
const checkAccounts = require('../checkAccounts');
const channels = require('../../.botconfig/channels.json');

//////////////////////////////////////////////////////////////

Canvas.registerFont(path.join(__dirname, '../../fonts/Franklin Gothic Condensed.ttf'), { family: 'FranklinGothic' });

/////////////////////////////////////////////////////////////

/**
 * 
 * @param {GuildMember} member 
 */
async function welcomeMessageMember(member, test = false) {
    try {
        const channel = member.guild.channels.cache.get(test ? channels.BOT_TESTING : channels.WELCOME);
        if (channel) {
            const guild = member.guild;
            const count = guild.memberCount;

            const canvas = Canvas.createCanvas(1138, 640);
            const ctx = canvas.getContext('2d');

            const background = await Canvas.loadImage(path.join(__dirname, '../../images/welcome_background_blur.png'));
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

            let avatarImage = member.user.avatarURL({ extension: 'png' }) || member.user.defaultAvatarURL;
            
            const avatar = await Canvas.loadImage(avatarImage);

            const radius = 124;
            const x = canvas.width / 2;
            const y = canvas.height / 2 - 56;

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

            /*ctx.font = 'bold 64px FranklinGothic';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgb(0, 0, 0)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;
            ctx.fillText('BIENVENID@', x, y + radius + 60);

            ctx.font = '36px FranklinGothic';
            ctx.fillText(member.user.username.replace(/@/g, '@\u200b'), x, y + radius + 106);

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });*/

            const y2 =  y + 20

            ctx.font = 'bold 82px FranklinGothic';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgb(0, 0, 0)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;
            ctx.fillText('BIENVENID@', x, y2 + radius + 60);

            ctx.font = '48px FranklinGothic';
            ctx.fillText(member.user.username.replace(/@/g, '@\u200b'), x, y2 + radius + 108);

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });


            channel.send(
                {
                    content: `# Bienvenido al servidor, ${member}!\n\n***Recuerda pasarte por <#1119803609773785159> para obtener roles y acceder a los diferentes canales de este servidor***. \n\nContigo somos **${count}** miembros y esperamos que disfrutes de tu estancia en **GD Venezuela**!`,
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
    /**
     * @param {Client} _client
     * @param {Db} database
     * @param {GuildMember} member
     */
    async execute(_client, database, member) {
        try {
            if (member.guild.id !== '1119795689984102455') return;
            if (await checkAccounts.checkUserAccountAge(member.guild, database, member)) {
                // Updates the cache for the member in the guild. This is necessary to ensure 
                // that the member is properly cached after they join the guild.
                await member.guild.members.fetch(member.id);
                await welcomeMessageMember(member);
            }
        } catch (e) {
            logger.ERR(e)
        }
    },
    welcomeMessageMember
};