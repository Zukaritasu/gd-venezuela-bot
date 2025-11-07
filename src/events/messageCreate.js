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

const { Events, Client, ChatInputCommandInteraction, Message, GuildMember, AttachmentBuilder, ChannelType } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../logger');
const Canvas = require('canvas');
const utils = require('../utils');
const path = require('path');
const channels = require('../../.botconfig/channels.json');
const submit = require('../commands/records/submit');
const checkAttachments = require('../checkAttachments')

///////////////////////////////////////////////////////////

Canvas.registerFont(path.join(__dirname, '../../fonts/MakroTrial-Bold.otf'), { family: 'MakroTrial' });

/**
 * List of user IDs that are whitelisted to use certain commands.
 * This is used to restrict access to commands that should only be available to specific users.
 */
const usersWhitelist = [
    '318153353555345408' // polenta
];

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

/**
 * 
 * @param {Message} message 
 * @returns {Promise<boolean}
 */
async function repliedMessageContainsEmbedSubmitPack(client, message) {
    if (!message.reference || !message.reference?.messageId)
        return false;

    const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
    if (!repliedMessage || repliedMessage.author.id !== '1294111960882872341' /* bot id */)
        return false;
    return repliedMessage.embeds.length > 0 ? repliedMessage.embeds[0].fields.find(field => field.name === 'Pack') !== undefined : false
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
                if (message.channel.type === ChannelType.DM) {
                    // Handle direct messages here if needed
                    return
                }

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
                } else if (message.content.startsWith('--users-exception')) {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/text-commands/users-exception').process(getCommandParameters(message.content), database, message)
                } else if (message.content.startsWith('--test-command')) {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/youtube/service-notification').testCommand(message.channel)
                } 
                
                else if (message.content.startsWith('--aceptar') && message.channel.id === /*'1294668385950498846'*/ channels.SUBMITS) {
                    const submitPack = await repliedMessageContainsEmbedSubmitPack(client, message)
                    if (utils.hasUserPermissions(message.member) || usersWhitelist.includes(message.member.id))
                        await require(submitPack ? '../commands/packs/pack' : '../commands/records/record').accept(message)
                } else if (message.content.startsWith('--rechazar') && message.channel.id === /*'1294668385950498846'*/ channels.SUBMITS) {
                    const submitPack = await repliedMessageContainsEmbedSubmitPack(client, message)
                    if (utils.hasUserPermissions(message.member) || usersWhitelist.includes(message.member.id))
                        await require(submitPack ? '../commands/packs/pack' : '../commands/records/record').decline(message)
                } 
                
                else if (message.content.startsWith('--denegar') && message.channel.id === /*'1119807234076049428'*/ channels.MODERATION) {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/user-verification').denyUser(client, database, message, getCommandParameters(message.content))
                } else if (message.content.startsWith('--aprobar') && message.channel.id === /*'1119807234076049428'*/ channels.MODERATION) {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/user-verification').approveUser(client, database, message, getCommandParameters(message.content))
                } else if (message.content.startsWith('--dm') && [channels.MODERATION, channels.BOT_TESTING].find(channel => channel === message.channel.id)) {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/user-verification').sendDM(client, message, message.content)
                } else if (message.content.startsWith('--save-hash')) {
                    if (utils.hasUserPermissions(message.member))
                        await require('../commands/text-commands/save-hashes').saveHashes(database, message)
                } else if (message.channel.id === channels.SEND_RECORD) {
                    if (message.member.roles.cache.has('1119804850620866600') /* rol venezolado id */) {
                        const command = message.content.split('\n');
                        if (command.length >= 3) {
                            await submit.processSubmitRecord(database, message, command);
                        } else {
                            await message.react('❌');
                        }
                    }
                } else if (message.attachments.size > 0 && !utils.hasUserPermissions(message.member) && !message.member.roles.cache.has('1216132476674773142') /* rol Notable */) {
                    await checkAttachments.check(database, message)
                }
            }
        } catch (e) {
            logger.ERR(e)
            try {
                await message.reply(e.message)
            } catch {

            }
        }
    }
}