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

const { ChatInputCommandInteraction } = require("discord.js");
const channels = require('../../../.botconfig/channels.json')
const logger = require('../../logger')

const URL_PREFIX_TIKTOK_VIDEO = 'https://vt.tiktok.com/'

/**
 * Validates a TikTok video identifier or URL and publishes a notification
 * containing the canonical short link for the video.
 *
 * The `video` option may be a numeric video ID or an HTTPS TikTok URL using
 * one of the supported video path formats. Invalid values are reported back
 * to the interaction and are not sent to the notification channel.
 *
 * @param {ChatInputCommandInteraction} interaction Discord command interaction
 * @returns {Promise<void>} Resolves after the notification is sent or handled
 *  as an error.
 */
async function notify(interaction) {
	try {
		const video = interaction.options.getString('video')
		const videoId = video?.match(/^(\d{8,20})$/)?.[1]
			?? video?.match(/^https?:\/\/(?:www\.)?tiktok\.com\/(?:@[^/]+\/video\/|t\/|v\/)(\d{8,20})(?:[/?#]|$)/i)?.[1]

		if (!videoId) {
			throw new Error('El valor debe ser un ID válido o un enlace válido de un video de TikTok')
		}

		const channel = await interaction.guild.channels.fetch(channels.YOUTUBE_NOTIFICATIONS)
		if (!channel) {
			throw new Error('Channel not found');
		}

		await channel.send(`<@&${process.env.ID_ROL_YOUTUBE_NOTIFICACIONES}>\n`
			+ `He subido un nuevo vídeo a TikTok, vayan a verlo! ${URL_PREFIX_TIKTOK_VIDEO + videoId}`
		)
	} catch (error) {
		logger.ERR(error)
		try {
			await interaction.reply(error.message)
		} catch {
			
		}
	}
}

module.exports = {
	notify
}