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

const { Events, Client, ChatInputCommandInteraction, Message, GuildMember } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../logger');
const utils = require('../utils');

///////////////////////////////////////////////////////////

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
                }
            }
        } catch (e) {
            message.reply(e.message)
        }
    }
}