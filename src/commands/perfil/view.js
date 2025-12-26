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

const { Client, ChatInputCommandInteraction, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../logger');
const utils = require('../../utils');
const { Db } = require('mongodb');
const { COLL_PROFILES, COLL_TEXT_XP } = require('../../../.botconfig/database-info.json');
const { roleIcons } = require('../../../.botconfig/roleIcons.json');

/**
 * @typedef {Object} Profile
 * @property {string} userId - User ID
 * @property {string|null} [description] - Profile description
 * @property {{ day: number, month: number }|null} [birthday] - Birthday object
 * @property {string|null} [hardestVideo] - Video URL
 * @property {string|null} [hardestName] - Hardest level name
 * @property {string|null} [color] - Hex color code
 * @property {string|null} [youtubeChannel] - YouTube channel URL
 * @property {string|null} [twitchChannel] - Twitch channel URL
 * @property {string|null} [twitterProfile] - Twitter profile URL
 * @property {string|null} [tikTokProfile] - TikTok profile URL
 */

const charges = {
	staff: [
		{ roleId: '1119804656923709512', name: 'Dictador' },
		{ roleId: '1119804806521946155', name: 'Tribunal Supremo' },
		{ roleId: '1121221914254397592', name: 'Ministerio' },
	]
}

/**
 * 
 * @param {Client} client 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function view(client, database, interaction) {
	try {
		await interaction.deferReply();

		const user = interaction.options.getUser('usuario') || interaction.user;
		let member = interaction.guild.members.cache.get(user.id);
		if (!member) {
			try {
				member = await interaction.guild.members.fetch(user.id);
			} catch (error) {
				return await interaction.editReply({
					content: 'El usuario no está en el servidor.'
				});
			}
		}

		if (user.bot)
			return await interaction.editReply({ content: 'Los bots no tienen perfil.' });
		if (!member.roles.cache.has('1119804850620866600')) {
			return await interaction.editReply({
				content: 'El perfil solo está disponible para Venezolanos.'
			});
		}

		const [profileRaw, responseRaw] = await Promise.all([
			database.collection(COLL_PROFILES).findOne({ userId: user.id }),
			database.collection(COLL_TEXT_XP).findOne({ type: 'userlist' })
		]);

		/** @type {Profile} */
		const profile = profileRaw ?? {};
		const response = responseRaw?.userlist ? responseRaw : { userlist: [] };
		const userEntry = response.userlist.find(u => u.id === member.id);

		const embed = new EmbedBuilder()
		embed.setTitle(user.tag)
		embed.setColor(profile?.borderColor ? profile.borderColor : 0x2b2d31)
		embed.setThumbnail(user.displayAvatarURL({ size: 128, extension: 'png' }))
		embed.setDescription(profile?.description ? profile.description : '*(Sin descripción)*');

		const fields = [
			member.roles.cache.find(r => charges.staff.some(c => c.roleId === r.id)) ? {
				name: 'Cargo',
				value: `*(Staff del servidor)*`,
				inline: true
			} : null,
			profile?.birthday ?
				{
					name: 'Cumpleaños',
					value: `${profile.birthday.day.toString().padStart(2, '0')}/${profile.birthday.month.toString().padStart(2, '0')}`,
					inline: true
				} : null,
			member.joinedAt ? {
				name: 'Unido desde',
				value: utils.formatDate(member.joinedAt),
				inline: true
			} : null,
			profile?.hardestName ?
				{
					name: 'Hardest',
					value: profile.hardestName,
					inline: true
				} : null,
			userEntry ?
				{
					name: 'XP Posición',
					value: `#${userEntry.position.toString().padStart(2, '0')}`,
					inline: true
				} : null,
			{
				name: 'Badges',
				value: member.roles.cache.map(role => {
					const roleIcon = roleIcons.find(r => r.name.split('_')[1] === role.id);
					if (roleIcon)
						return `<:${roleIcon.name}:${roleIcon.id}>`;
					return null;
				}).filter(str => str !== null).join(' '),
				inline: false
			}
		].filter(f => f !== null && f.value.length <= 1024 && f.value.length > 0);

		embed.addFields(fields);

		const isCreateButton = profile?.hardestVideo || profile?.tikTokProfile || profile?.youtubeChannel
			|| profile?.twitchChannel || profile?.twitterProfile ? true : false;

		const message = {
			embeds: [embed],
			components: [
				isCreateButton ? new ActionRowBuilder().addComponents(
					[
						profile?.hardestVideo ? new ButtonBuilder()
							.setLabel('Video de mi Hardest')
							.setStyle(ButtonStyle.Link)
							.setURL(profile.hardestVideo) : null,
						profile?.youtubeChannel ? new ButtonBuilder()
							.setEmoji('<:youtube:1434222491328319610>')
							.setStyle(ButtonStyle.Link)
							.setURL(profile.youtubeChannel) : null,
						profile?.twitchChannel ? new ButtonBuilder()
							.setEmoji('<:twitch:1434222490095452383>')
							.setStyle(ButtonStyle.Link)
							.setURL(profile.twitchChannel) : null,
						profile?.twitterProfile ? new ButtonBuilder()
							.setEmoji('<:twitter:1434222493706748066>')
							.setStyle(ButtonStyle.Link)
							.setURL(profile.twitterProfile) : null,
						profile?.tikTokProfile ? new ButtonBuilder()
							.setEmoji('<:tiktok:1434222492507181129>')
							.setStyle(ButtonStyle.Link)
							.setURL(profile.tikTokProfile) : null
					].filter(Boolean)
				) : null
			].filter(Boolean)
		}

		await interaction.editReply(message);
	} catch (error) {
		logger.ERR(error)
	}
}

module.exports = {
	view
};