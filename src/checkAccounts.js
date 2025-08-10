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

const { Guild, GuildMember, EmbedBuilder } = require("discord.js");
const { Db } = require("mongodb");
const logger = require('./logger');
const utils = require('./utils');
const channels = require('../.botconfig/channels.json');

const ModerationAction = {
    KICK: 'active',
    BAN: 'banned'
};


/**
 * Check if the member is in the whitelist
 * @param {Db} database
 * @param {GuildMember} member
 * @returns {Promise<boolean>} true if the member is in the whitelist, false otherwise
 */
async function verifyMemberInWhiteList(database, member) {
	const config = database.collection('config');
	let whiteListMembers = await config.findOne(
		{
			type: 'white_list_new_users'
		}
	);

	if (!whiteListMembers || !whiteListMembers.users) {
		// If it doesn't exist, create it with an empty array of users
		await config.insertOne(whiteListMembers = {
			type: 'white_list_new_users',
			users: []
		});
	}

	if (!Array.isArray(whiteListMembers.users)) {
		whiteListMembers.users = [];
	}

	// Check if the user is already in the whitelist
	return whiteListMembers.users.includes(member.user.id);
}

/**
 * Create an embed report for the moderation action
 * @param {GuildMember} member
 * @param {string} actionText
 * @returns {EmbedBuilder} The embed report
 */
function createEmbedReport(member, actionText) {
	const embed = new EmbedBuilder()
	embed.setColor(0x2b2d31)
	embed.setTitle(member.user.tag)
	embed.setDescription(`Ha sido **${actionText}** automáticamente por tener una cuenta nueva.`)
	embed.setThumbnail(member.user.displayAvatarURL({ size: 128, extension: 'png' }))
	embed.setFields(
		{
			name: 'User ID',
			value: member.user.id,
			inline: true
		},
		{
			name: 'Joined Discord',
			value: utils.formatDate(member.user.createdAt),
			inline: true
		}
	)

	return embed;
}

/** * Execute a moderation action on the member
 * @param {Guild} guild
 * @param {GuildMember} member
 * @param {ModerationAction} action
 * @returns {Promise<boolean>} false if the action was taken, true otherwise
 */
async function executeModerationAction(guild, member, action) {
	try {
		let reportChannel = guild.channels.cache.get(channels.MODERATION); // moderation channel
		let actionText = '';
		if (action === ModerationAction.KICK) {
			await member.kick('Account too new');
			actionText = 'expulsado';
		} else if (action === ModerationAction.BAN) {
			await member.ban({ reason: 'Account too new' });
			actionText = 'baneado';
		}
		if (reportChannel && actionText) {
			await reportChannel.send({
				embeds: [
					createEmbedReport(member, actionText)
				]
			});
		}
	} catch (e) {
		logger.ERR(`Error executing moderation action on ${member.user.tag}: ${e.message}`);
	}

	return false; // Return false to indicate the action was taken
}

/**
 * Check if the user account is older than 21 days
 * @param {Guild} guild
 * @param {Db} database
 * @param {GuildMember} member 
 * @returns {Promise<boolean>} true if the account is older than 21 days, false otherwise
 */
async function checkUserAccountAge(guild, database, member) {
	const accountAgeMs = Date.now() - member.user.createdAt.getTime();
	const sevenDaysMs = 21 * 24 * 60 * 60 * 1000; // 21 days in milliseconds
	if (accountAgeMs < sevenDaysMs && !(await verifyMemberInWhiteList(database, member))) {
		try {
			await member.send(
				'**[Español]** Hola! No puedes ingresar al servidor porque tu cuenta de Discord no cumple con la antigüedad mínima requerida. Utiliza el comando /verify para que el Staff pueda verificar tu cuenta y permitirte el acceso al servidor.\n\n' +
				'**[English]** Hello! You cannot join the server because your Discord account does not meet the minimum age requirement. Use the /verify command so that the Staff can verify your account and allow you access to the server.'
			);
		} catch (e) {
			logger.ERR(`Unable to send message via DM to ${member.user.tag}: ${e}`);
			if (e.code === 50007) { // Cannot send messages to this user
				return await executeModerationAction(guild, member, ModerationAction.BAN);
			}
		}
		return await executeModerationAction(guild, member, ModerationAction.KICK);
	}
	return true;
}

/**
 * Check all users account age in the guild
 * @param {Guild} guild 
 * @param {Db} database
 */
async function checkAllUsersAccountAge(guild, database) {
	const members = await guild.members.fetch();
	for (const member of members.values()) {
		try {
			if (member.user.bot)
				continue; // Skip bots
			await checkUserAccountAge(guild, database, member);
		} catch (e) {
			logger.ERR(`Error checking account age for ${member.user.tag}: ${e.message}`);
		}
	}
}

module.exports = {
	checkAllUsersAccountAge,
	checkUserAccountAge
};
