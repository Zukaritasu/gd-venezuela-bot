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

const { Events, Client, ChatInputCommandInteraction, Message, GuildMember, AttachmentBuilder } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../logger');
const Canvas = require('canvas');
const utils = require('../utils');
const path = require('path');

const submit = require('../commands/records/submit');

///////////////////////////////////////////////////////////

Canvas.registerFont(path.join(__dirname, '../../fonts/MakroTrial-Bold.otf'), { family: 'MakroTrial' });

/**
 * @param {string} content
 * @returns {string[]} 
 */
function getCommandParameters(content) {
    let parts = content.split(' ')
    if (parts.length >= 2) {
        parts = parts.slice(1)
        for (let i = 0; i < parts.length; i++)
            parts[i] = parts[i].trim()
        return parts
    }

    return []
}

module.exports = {
    name: Events.MessageCreate,
    once: false,
    /**
     * @param {Client} client 
     * @param {Db} database 
     * @param {Message} message 
     */
    async execute(client, database, message) {
        try {
            if (message.member && !message.member.user.bot) {
                //await require('./voiceStateUpdate').resetTimeout(client, message.member)
                if (message.content.startsWith('--scan')) {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/text-commands/scan').scan(database, message, getCommandParameters(message.content))
                } else if (message.content.startsWith('--update')) {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/text-commands/update-leaderboard').update(database, message)
                } else if (message.content.startsWith('--clean')) {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/text-commands/clean').clean(message)
                } else if (message.content.startsWith('--blacklist')) {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/text-commands/topxp-blacklist').process(getCommandParameters(message.content), database, message)
                } else if (message.content.startsWith('--test-command')) {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/youtube/service-notification').testCommand(message.channel)
                } else if (message.content.startsWith('--aceptar') && message.channel.id === /*'1294668385950498846'*/ '1369858143122886769') {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/records/record').accept(message)
                }  else if (message.content.startsWith('--rechazar') && message.channel.id === /*'1294668385950498846'*/ '1369858143122886769') {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/records/record').decline(message)
                } else if (message.content.startsWith('--test-welcome')) {
                    if (utils.hasUserPermissions(message.member)) {
                        const member = message.member;
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

                        message.reply(
                            {
                                content: `# Bienvenido al servidor, ${member}!\n\n***Recuerda pasarte por <#1119803609773785159> para obtener roles y acceder a los diferentes canales de este servidor***. \n\nContigo somos **${count}** miembros y esperamos que disfrutes de tu estancia en GD Venezuela!`,
                                files: [attachment]
                            }
                        );
                    }
                } else if (message.channel.id === '1369415419093586070') {
                    if (message.member.roles.cache.has('1119804850620866600')) {
                        const command = message.content.split('\n');
                        if (command.length >= 3) {
                            await submit.processSubmitRecord(message, command);
                        } else {
                            await message.react('❌');
                        }
                    }
                }/* else if (message.channel.id === '1294668385950498846' && message.author.id === '591640548490870805') {
                    const command = message.content.split('\n');
                    if (command.length >= 3) {
                        await submit.processSubmitRecord(message, command);
                    } else {
                        await message.react('❌');
                    }
                }*/
            }
        } catch (e) {
            logger.ERR(e)
            message.reply(e.message)
        }
    }
}