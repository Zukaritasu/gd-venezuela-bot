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
const { Db } = require('mongodb');

const ModerationAction = {
    KICK: 'active',
    BAN: 'banned'
};

async function updateCache(member) {
    try {
        await member.guild.members.fetch(member.id);
        logger.INF('The cache has been updated with the new member!')
    } catch (e) {
        logger.ERR(e)
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
            //logger.DBG(avatarImage)

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
            ctx.fillText(sanitizeUsername(member.user.username), x, y + radius + 106);

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

/**
 * Check if the member is in the whitelist
 * @param {Db} database
 * @param {GuildMember} member
 * @returns {Promise<boolean>} true if the member is in the whitelist, false otherwise
 */
async function verifyMemberInWhiteList(database, member) {
    const config = database.collection('config');
    let whiteListMembers = await config.findOne(
        {
            type: 'white_list_new_users'
        }
    );

    if (!whiteListMembers || !whiteListMembers.users) {
        // If it doesn't exist, create it with an empty array of users
        await config.insertOne(whiteListMembers = {
            type: 'white_list_new_users',
            users: []
        });
    }

    if (!Array.isArray(whiteListMembers.users)) {
        whiteListMembers.users = [];
    }

    // Check if the user is already in the whitelist
    return whiteListMembers.users.includes(member.user.id);
}

/** * Execute a moderation action on the member
 * @param {Guild} guild
 * @param {GuildMember} member
 * @param {ModerationAction} action
 * @returns {Promise<boolean>} false if the action was taken, true otherwise
 */
async function executeModerationAction(guild, member, action) {
    try {
        let reportChannel = guild.channels.cache.get('1119807234076049428'); // moderation channel
        let actionText = '';
        if (action === ModerationAction.KICK) {
            await member.kick('Account too new');
            actionText = 'expulsado';
        } else if (action === ModerationAction.BAN) {
            await member.ban({ reason: 'Account too new' });
            actionText = 'baneado';
        }
        if (reportChannel && actionText) {
            reportChannel.send(
                `El usuario ${member.user.tag} (${member.user.id}) ha sido **${actionText}** automáticamente por tener una cuenta demasiado nueva.`
            );
        }
    } catch (e) {
        logger.ERR(`Error executing moderation action on ${member.user.tag}: ${e.message}`);
    }

    return false; // Return false to indicate the action was taken
}

/**
 * Check if the user account is older than 21 days
 * @param {Guild} guild
 * @param {Db} database
 * @param {GuildMember} member 
 * @returns {Promise<boolean>} true if the account is older than 21 days, false otherwise
 */
async function checkUserAccountAge(guild, database, member) {
    const accountAgeMs = Date.now() - member.user.createdAt.getTime();
    const sevenDaysMs = 21 * 24 * 60 * 60 * 1000; // 21 days in milliseconds
    if (accountAgeMs < sevenDaysMs && !(await verifyMemberInWhiteList(database, member))) {
        try {
            await member.send(
                '**[Español]** Hola! No puedes ingresar al servidor porque tu cuenta de Discord no cumple con la antigüedad mínima requerida. Utiliza el comando /verify para que el Staff pueda verificar tu cuenta y permitirte el acceso al servidor.\n\n' + 
                '**[English]** Hello! You cannot join the server because your Discord account does not meet the minimum age requirement. Use the /verify command so that the Staff can verify your account and allow you access to the server.'
            );
        } catch (e) {
            if (e.code === 50007) // Cannot send messages to this user
                return await executeModerationAction(guild, member, ModerationAction.BAN);
            logger.ERR(`Unable to send message via DM to ${member.user.tag}: ${e}`);
        }
        return await executeModerationAction(guild, member, ModerationAction.KICK);
    }
    return true;
}

/**
 * Check all users account age in the guild
 * @param {Guild} guild 
 * @param {Db} database
 */
async function checkAllUsersAccountAge(guild, database) {
    const members = await guild.members.fetch();
    for (const member of members.values()) {
        try {
            if (member.user.bot)
                continue; // Skip bots
            await checkUserAccountAge(guild, database, member);
        } catch (e) {
            logger.ERR(`Error checking account age for ${member.user.tag}: ${e.message}`);
        }
    }
}

function sanitizeUsername(username) {
    return username.replace(/@/g, '@\u200b');
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
            if (await checkUserAccountAge(member.guild, database, member)) {
                await updateCache(member);
                await welcomeMessageMember(member);
            }
        } catch (e) {
            logger.ERR(e)
        }
    },
    checkAllUsersAccountAge
};