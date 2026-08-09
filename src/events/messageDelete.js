/**
 * Copyright (C) 2026 Zukaritasu
 * 
 * This program is free software: you can redistribute it and/or modify
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

const { Events, Client, ChatInputCommandInteraction, Message,
	GuildMember, AttachmentBuilder, ChannelType } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../logger');

module.exports = {
	name: Events.MessageDelete,
	once: false,

	/**
	 * @param {Client} _client
	 * @param {Db} _database
	 * @param {Message} message
	 */
	async execute(_client, _database, message) {
		try {
			if (message.author.bot || message.channel.id !== '1272033491390828574')
				return;
			//logger.DBG(`Message deleted in [${message.channel.name}] by ${message.author.tag}: ${message.content}`);
		} catch (error) {
			logger.ERR(error);
		}
	}
}