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

const { Message, TextChannel, EmbedBuilder, GuildMember } = require("discord.js");
const channels = require('../.botconfig/channels.json')
const logger = require('./logger')

const channelsToIgnore = [
	channels.GDBOT, channels.BOT_MODERATION
]

/**
 * Logs when a member leaves the configured Geometry Dash Venezuela server.
 * The audit message is sent to the server's log channel.
 *
 * @param {GuildMember} member The member who left the server.
 * @returns {Promise<void>} Resolves after the leave event has been processed.
 */
async function guildMemberRemove(member) {
	try {
		if (member.guild.id !== process.env.SERVER_GD_VENEZUELA_ID) {
			return
		}

		/**@type {TextChannel} */
		const logChannel = global.guild.channels.cache.get(channels.LOG) ??
			await global.guild.channels.fetch(channels.LOG)

		logChannel?.send(`The user ${member.user.tag}#${member.user.id} has left the server`)
	} catch (error) {
		logger.ERR(error)
	}
}

/**
 * Logs a deleted message from the configured Geometry Dash Venezuela server.
 * Messages from ignored channels and messages authored by the bot are skipped.
 * The audit embed includes the message author, channel, content, and attachment
 * count when attachments are present.
 *
 * @param {Message} message The deleted message to audit.
 * @returns {Promise<void>} Resolves after the deletion event has been processed.
 */
async function messageDelete(message) {
	try {
		if (channelsToIgnore.some(ch => ch === message.channelId)
			|| message.author.id === process.env.BOT_ID
			|| message.guild.id !== process.env.SERVER_GD_VENEZUELA_ID) {
			return
		}

		/**@type {TextChannel} */
		const logChannel = global.guild.channels.cache.get(channels.LOG) ??
			await global.guild.channels.fetch(channels.LOG)

		if (!logChannel) return

		const fields = [
			{ name: 'User', value: `${message.author.tag} - ${message.author.id}`, inline: true },
			{ name: 'Channel', value: `<#${message.channelId}>`, inline: true }
		]

		if (message.attachments.size > 0) {
			fields.push({ name: 'Attachments', value: message.attachments.size.toString(), inline: true })
		}

		logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle('Message Deleted')
					.setDescription(message.content.length == 0 ? '-# No content' : message.content)
					.addFields(fields)
			]
		})
	} catch (error) {
		logger.ERR(error)
	}
}

module.exports = {
	messageDelete,
	guildMemberRemove
}