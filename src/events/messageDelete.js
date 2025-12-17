const { Events, Client, ChatInputCommandInteraction, Message, GuildMember, AttachmentBuilder, ChannelType } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../logger');

module.exports = {
    name: Events.MessageCreate,
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
			logger.DBG(`Message deleted in [${message.channel.name}] by ${message.author.tag}: ${message.content}`);
		} catch (error) {
			logger.ERR(error);
		}
	}
}