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

const { Events, Client, RateLimitError } = require('discord.js');
const logger = require('../logger');
const utils = require('../utils');

const services = [
	//'../commands/youtube/service-notification.js',
	'../commands/gdvzla-list/service-levels.js',
	'../commands/gdvzla-list/service-levels-p.js',
	'../commands/leveling/service-auto-update.js',
]

/**
 * Convert an emoji character to its corresponding twemoji URL.
 * @param {string} emoji - The emoji character
 * @returns {string} URL of the twemoji image
 */
function emojiToTwemojiUrl(emoji) {
	const codePoints = [...emoji].map(char => char.codePointAt(0).toString(16)).join('-');
	return `https://twemoji.maxcdn.com/v/latest/72x72/${codePoints}.png`;
}

/**
 * Print all roles with emojis in their names
 * @param {Client} client 
 */
async function printRoles(client) {
	const guild = await client.guilds.fetch('1119795689984102455');
	const roles = await guild.roles.fetch();

	logger.DBG('Roles with emojis in their names:');

	for (const [, role] of roles) {
		if (role.iconURL()) {
			logger.DBG(`${role.name}\n${role.id}\n${role.iconURL()}\n----------------`);
		} else {
			const match = role.name.match(/^([\p{Emoji_Presentation}\p{Extended_Pictographic}])/u);
			if (match) {
				logger.DBG(`${role.name}\n${role.id}\n${emojiToTwemojiUrl(match[1])}\n----------------`);
			}
		}

	}
}


async function clearBotDMMessages(client, userId) {
	const targetUserId = '797892987106754580'; // El ID del usuario específico

	try {
		const user = await client.users.fetch(targetUserId);
		const dmChannel = await user.createDM();

		logger.DBG(`Buscando mensajes del bot en DM con el usuario ${user.tag}...`);

		let fetchedMessages;
		let messagesDeleted = 0;

		do {
			fetchedMessages = await dmChannel.messages.fetch({ limit: 100 });
			const botMessages = fetchedMessages.filter(m => m.author.id === client.user.id);

			if (botMessages.size === 0) {
				break;
			}

			for (const message of botMessages.values()) {
				await message.delete();
				messagesDeleted++;
			}
		} while (fetchedMessages.size >= 100);

		logger.DBG(`✅ Se eliminaron ${messagesDeleted} mensajes del bot en el DM.`);

	} catch (error) {
		logger.ERR(`❌ Error al limpiar los mensajes DM del usuario ${targetUserId}:`, error);
	}
}

module.exports = {
	name: Events.ClientReady,
	once: true,

	async execute(client, database) {
		// disconect afk users
		/*await require('./voiceStateUpdate').scanAndDisconnectUsers(client)
		await require('./voiceStateUpdate').scanVoiceChannels(client)*/

		await require('./voiceStateUpdate').scanVoiceChannelsActivity(client)

		//await printRoles(client);

		// Check new submit records
		//await require('../commands/gdvzla-list/service-levels').sortStatusError();
		await require('../commands/records/submit').checkNewSubmitRecords(client, database)
		
		// Load services

		for (let i = 0; i < services.length; i++) {
			try {
				const info = await require(services[i]).start(database, client)
				logger.INF(`Service ${info.fullname} has been loaded!`)
			} catch (error) {
				logger.ERR(`Error loading service: ${error.message}`)
			}
		}

		logger.INF(`Ready! Logged in as ${client.user.tag}`)

		// Load server members into the cache
		const guild = client.guilds.cache.get(process.env.SERVER_GD_VENEZUELA_ID)
		if (guild) {
			try {
				const allMembers = await utils.getAllMembers(guild)
				if (allMembers) {
					await require('../checkAccounts').checkAllUsersAccountAge(guild, database, allMembers);
				}
			} catch (e) {
				logger.ERR(e)
			}
		}

		//clearBotDMMessages(client)
	},
};