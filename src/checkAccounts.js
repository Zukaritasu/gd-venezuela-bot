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
const userKickManager = require('./userKickManager')
const utils = require('./utils');
const channels = require('../.botconfig/channels.json');
const { COLL_SERVER_NEW_ACCOUNTS } = require('../.botconfig/database-info.json')
const { RESTJSONErrorCodes } = require('discord-api-types/v10')

/////////////////////////////////////////////////
// Check user accounts age and take actions if necessary
//////////////////////////////////////////////////

/**
 * Enum for moderation actions
 * @readonly
 * @enum {string}
 */

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
async function verifyAccountInWhiteList(database, member) {
	const newAccounts = database.collection(COLL_SERVER_NEW_ACCOUNTS);
	let whiteListAccounts = await newAccounts.findOne(
		{
			type: 'whitelist'
		}
	);

	if (!whiteListAccounts || !whiteListAccounts.accounts) {
		// If it doesn't exist, create it with an empty array of users
		await newAccounts.insertOne(whiteListAccounts = {
			type: 'whitelist',
			accounts: []
		});
	}

	if (!Array.isArray(whiteListAccounts.accounts)) {
		whiteListAccounts.accounts = [];
	}

	// Check if the user is already in the whitelist
	return whiteListAccounts.accounts.includes(member.user.id);
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
			value: utils.formatDateTime(member.user.createdAt),
			inline: true
		}
	)

	return embed;
}

/** * Execute a moderation action on the member
 * @param {Guild} guild
 * @param {Db} database 
 * @param {GuildMember} member
 * @param {ModerationAction} action
 * @returns {Promise<boolean>} false if the action was taken, true otherwise
 */
async function executeModerationAction(guild, database, member, action) {
	try {
		let reportChannel = guild.channels.cache.get(channels.MODERATION); // moderation channel
		let actionText = '';
		if (action === ModerationAction.KICK) {
			await member.kick('Account too new');
			actionText = 'expulsado';
			await userKickManager.trackUserExpulsion(database, member.user);
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
 * Generate an invitation to the alternate server from a specific channel
 * 
 * @param {Client} client Discord client instance
 * @returns {Promise<string>} The invite URL
 */
async function generateAltServerInvite(client) {
	const altGuildId = '1405680731199508480';
	const altChannelId = '1405680732235370620';

	const altGuild = await client.guilds.fetch(altGuildId);
	const channel = await altGuild.channels.fetch(altChannelId);

	if (!channel || channel.type !== 0)
		throw new Error('The channel is not text-based or was not found');

	const invite = await channel.createInvite({
		maxAge: 0,
		maxUses: 1,
		unique: true,
		reason: 'Invitation to verify new account'
	});

	return `https://discord.gg/${invite.code}`;
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
	const daysMs = 21 * 24 * 60 * 60 * 1000; // 21 days in milliseconds
	if (accountAgeMs < daysMs && !(await verifyAccountInWhiteList(database, member))) {
		try {
			const inviteUrl = await generateAltServerInvite(guild.client);
			await member.send(`Hola! Tu cuenta de Discord no cumple con la antigüedad mínima requerida para ingresar directamente al servidor **GD Venezuela**.\n\nPara verificar tu acceso, únete al siguiente servidor alternativo: ${inviteUrl}\n\nEsto permitirá que el bot y tú compartan un servidor en común y puedas ejecutar el comando /verify por mensaje directo. Un moderador revisará tu solicitud, y si es aprobada, recibirás el enlace al servidor principal, de lo contrario serás baneado del servidor. ***Este proceso puede tardar unas pocas horas o un día***\n\nGracias por tu comprensión.`);
		} catch (e) {
			logger.ERR(`Unable to send message via DM to ${member.user.tag}: ${e}`);
			if (e.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser) {
				return await executeModerationAction(guild, database, member, ModerationAction.BAN);
			}
		}
		return await executeModerationAction(guild, database, member, ModerationAction.KICK);
	}
	return true;
}

/**
 * Check all users account age in the guild
 * @param {Guild} guild 
 * @param {Db} database
 */
async function checkAllUsersAccountAge(guild, database) {
	const allMembers = await utils.getAllMembers(guild)
	if (!allMembers) return
	
	for (const member of allMembers.values()) {
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
