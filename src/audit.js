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

		const user = member.user
		await logChannel?.send({
			embeds: [
				new EmbedBuilder()
					.setTitle('Guild Member Remove')
					.setDescription(`The user has left the server`)
					.setThumbnail(user.displayAvatarURL({ size: 128, extension: 'png' }))
					.addFields([
						{
							name: 'Username',
							value: user.tag,
							inline: true
						},
						{
							name: 'User ID',
							value: user.id,
							inline: true
						}
					])
			]
		})
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
		const author = message.author
		if (channelsToIgnore.some(ch => ch === message.channelId)
			|| author.id === process.env.BOT_ID
			|| message.guild.id !== process.env.SERVER_GD_VENEZUELA_ID) {
			return
		}

		/**@type {TextChannel} */
		const logChannel = global.guild.channels.cache.get(channels.LOG) ??
			await global.guild.channels.fetch(channels.LOG)

		if (!logChannel) return

		const fields = [
			{ name: 'User', value: `${author.tag} - ${author.id}`, inline: true },
			{ name: 'Channel', value: `<#${message.channelId}>`, inline: true }
		]

		if (message.attachments.size > 0) {
			fields.push({ name: 'Attachments', value: message.attachments.size.toString(), inline: true })
		}

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle('Message Deleted')
					.setDescription(message.content.length == 0 ? '-# No content' : message.content)
					.setThumbnail(author.displayAvatarURL({ size: 128, extension: 'png' }))
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