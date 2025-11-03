/**
 * Copyright (C) 2025 Zukaritasu
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

const { Client, ChatInputCommandInteraction, MessageFlags, InteractionWebhook } = require('discord.js');
const logger = require('../../logger');
const utils = require('../../utils');
const { Db } = require('mongodb');
const { COLL_PROFILES } = require('../../../.botconfig/database-info.json');

/**
 * 
 * @param {Client} client 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function configure(client, database, interaction) {
	try {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		let member = interaction.guild.members.cache.get(interaction.user.id);
		if (!member) {
			try {
				member = await interaction.guild.members.fetch(interaction.user.id);
			} catch (error) {
				return await interaction.editReply({
					content: 'El usuario no está en el servidor.'
				});
			}
		}

		if (!member.roles.cache.has('1119804850620866600')) {
			return await interaction.editReply({
				content: 'Comando disponible solo para Venezolanos.'
			});
		}

		const description    = interaction.options.getString('descripcion');
		const day            = interaction.options.getInteger('dia');
		const month          = interaction.options.getInteger('mes');
		const hardestVideo   = interaction.options.getString('hardest-video');
		const hardestName    = interaction.options.getString('hardest-nombre');
		const color          = interaction.options.getString('color');
		const youtubeChannel = interaction.options.getString('youtube-channel');
		const twitchChannel  = interaction.options.getString('twitch-channel');
		const twitterProfile = interaction.options.getString('twitter-profile');
		const tikTokProfile  = interaction.options.getString('tiktok-profile');

		if (description === null && day === null && month === null && hardestVideo === null && hardestName === null 
			&& color === null && youtubeChannel === null && twitchChannel === null 
			&& twitterProfile === null && tikTokProfile === null) {
			return await interaction.editReply('Debes proporcionar al menos una opción para configurar tu perfil.');
		}

		let profile = await database.collection(COLL_PROFILES).findOne({ userId: interaction.user.id });
		if (!profile) {
			profile = {
				userId: interaction.user.id
			};
		}

		if (description !== null) {
			profile.description = description === '-' ? null : description;
		}

		if (day !== null && month !== null) {
			profile.birthday = day === 0 || month === 0 ? null : { day, month };
		} else if (day !== null || month !== null) {
			return await interaction.editReply('Debes proporcionar tanto el día como el mes para configurar tu cumpleaños.');
		}

		if (hardestVideo !== null) {
			if (hardestVideo === '-') {
				profile.hardestVideo = null;
			} else {
				if (!utils.isValidYouTubeUrl(hardestVideo))
					return await interaction.editReply('El enlace de YouTube proporcionado no es válido. Por favor, proporciona un enlace válido.');
				profile.hardestVideo = utils.normalizeYoutubeLink(hardestVideo);
			}
		}

		if (hardestName !== null) {
			profile.hardestName = hardestName === '-' ? null : hardestName;
		}

		if (color !== null) {
			if (color === '-')
				profile.borderColor = null;
			else if (/^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(color))
				profile.borderColor = color;
			else
				return await interaction.editReply('Código de color no válido. Formato correcto: #RRGGBB');
		}

		if (youtubeChannel !== null) {
			profile.youtubeChannel = youtubeChannel === '-' ? null : youtubeChannel;
			if (profile.youtubeChannel !== null && !/^https?:\/\/(www\.)?youtube\.com\/(channel\/[\w\-]+|user\/[\w\-]+|c\/[\w\-]+|@[\w\-]+)(\?.*)?$/i.test(youtubeChannel)) {
				return await interaction.editReply('El enlace de canal de YouTube proporcionado no es válido. Por favor, proporciona un enlace válido.');
			}
		}

		if (twitchChannel !== null) {
			profile.twitchChannel = twitchChannel === '-' ? null : twitchChannel;
			if (profile.twitchChannel !== null && !/^https?:\/\/(www\.)?twitch\.tv\/[a-zA-Z0-9_]+$/i.test(twitchChannel)) {
				return await interaction.editReply('El enlace de canal de Twitch proporcionado no es válido. Por favor, proporciona un enlace válido.');
			}
		}

		if (twitterProfile !== null) {
			profile.twitterProfile = twitterProfile === '-' ? null : twitterProfile;
			if (profile.twitterProfile !== null && !/^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+$/i.test(twitterProfile)) {
				return await interaction.editReply('El enlace de perfil de Twitter proporcionado no es válido. Por favor, proporciona un enlace válido.');
			}
		}

		if (tikTokProfile !== null) {
			profile.tikTokProfile = tikTokProfile === '-' ? null : tikTokProfile;
			if (profile.tikTokProfile !== null && !/^https?:\/\/(www\.)?tiktok\.com\/@[\w\-.]+$/i.test(tikTokProfile)) {
				return await interaction.editReply('El enlace de perfil de TikTok proporcionado no es válido. Por favor, proporciona un enlace válido.');
			}
		}

		await database.collection(COLL_PROFILES).updateOne(
			{ userId: interaction.user.id },
			{ $set: profile },
			{ upsert: true }
		);

		await interaction.editReply('Tu perfil ha sido actualizado correctamente.');
	} catch (error) {
		logger.ERR(error)
		try {
			await interaction.editReply('Ocurrió un error al actualizar tu perfil. Por favor, intenta nuevamente más tarde.');
		} catch {
			// ignore
		}
	}
}

module.exports = {
	// Configuration settings for the perfil command can be added here in the future
	configure
};