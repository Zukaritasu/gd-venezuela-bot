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

const { ChatInputCommandInteraction, MessageFlags } = require("discord.js");
const channels = require('../../../.botconfig/channels.json')
const logger = require('../../logger')

const URL_PREFIX_TIKTOK_VIDEO = 'https://vt.tiktok.com/'

/**
 * Resolves a TikTok video identifier from a numeric ID, a video URL, or a
 * shortened TikTok link. Shortened links are requested so their redirect can
 * be inspected for the canonical video ID.
 *
 * @param {string} id Numeric video ID, TikTok video URL, or shortened link.
 * @returns {Promise<string|null>} The video ID, or null when it cannot be found.
 * @throws {Error} If the TikTok link cannot be requested or resolved.
 */
async function getVideoId(id) {
	if (/^\d+$/.test(id)) {
		return id;
	}

	const directMatch = id.match(/\/video\/(\d+)/);
	if (directMatch) {
		return directMatch[1];
	}

	let targetUrl = id;
	if (!id.startsWith('http://') && !id.startsWith('https://')) {
		targetUrl = `https://vt.tiktok.com/${id}`;
	}

	try {
		const response = await axios.get(targetUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.5',
			},
			maxRedirects: 10,
		});

		const finalUrl = response.request?.res?.responseUrl || response.config?.url;
		const redirectMatch = finalUrl?.match(/\/video\/(\d+)/);

		if (redirectMatch) {
			return redirectMatch[1];
		}
	} catch (error) {
		if (error.response?.headers?.location) {
			const locationMatch = error.response.headers.location.match(/\/video\/(\d+)/);
			if (locationMatch) {
				return locationMatch[1];
			}
		}

		throw new Error(`No se pudo obtener el ID del video: ${error.message}`);
	}

	return null;
}

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
		const videoId = await getVideoId(interaction.options.getString('video')?.trim())
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

		await interaction.reply('¡Notificación enviada con éxito!')
	} catch (error) {
		logger.ERR(error)
		try {
			await interaction.reply({
				content: error.message,
				flags: MessageFlags.Ephemeral
			})
		} catch {

		}
	}
}

module.exports = {
	notify
}