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

const { Guild, GuildMember, User } = require('discord.js');
const logger = require('./logger');
const GITHUB_TOKEN = require('../.botconfig/token.json').GITHUB_TOKEN;
const axios = require('axios');

/** @type {import('redis').RedisClientType} */
let redisObject = null

/**
 * @typedef {Object} Pack
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {Number} points
 * @property {string} verifier
 */

/**
 * @typedef {Object} Record
 * @property {string} user
 */

/**
 * @param {string} fileName - The name of the file (without extension) to retrieve.
 * @returns {Promise<{sha: string, content: object}>} The file's SHA and parsed content.
 */
async function getGitHubFile(fileName) {
	const response = await axios.get(`https://api.github.com/repos/Abuigsito/gdvzla/contents/public/data/${fileName}.json`, {
		headers: {
			Authorization: `token ${GITHUB_TOKEN}`
		}
	});
	return {
		sha: response.data.sha,
		content: JSON.parse(Buffer.from(response.data.content, "base64").toString())
	};
}

module.exports = {
	/** 
	 * @returns {Promise<string[]>} 
	 */
	getPacksNames: async () => {
		const key = 'getPacksNames'
		const response = await redisObject.get(key)
		if (response) {
			return JSON.parse(response);
		}

		const packs = await getGitHubFile('_packs')
		const packsNames = packs.content.map(pack => pack.name)
		await redisObject.set(key, JSON.stringify(packsNames), { EX: 21600 })
		return packsNames
	},
	/** @returns {Promise<Pack[]>} */
	getPacks: async () => {
		const packs = await getGitHubFile('_packs')
		return packs.content
	},

	/**
	 * @returns {Promise<{sha:string, content: Pack[]}>}
	 */
	getPacksFile: async () => await getGitHubFile('_packs'),


	/**
	 * @param {string} fileId 
	 * @returns {Promise<{sha:string, content: Record[]}>}
	 */
	getPackFileLeaderboard: async (fileId) => await getGitHubFile(`packs/${fileId}_records`),

	/**
	 * 
	 * @param {{sha:string, content: Record[]}} fileLeaderboard 
	 * @param {string} fileId
	 * @param {User} moderator 
	 */
	savePackFileLeaderboard: async (fileLeaderboard, fileId, moderator) => {
		const fileContent = Buffer.from(JSON.stringify(fileLeaderboard.content, null, 4)).toString("base64");
		await axios.put(`https://api.github.com/repos/Abuigsito/gdvzla/contents/public/data/packs/${fileId}_records.json`, {
			message: `Updated ${fileId}_records.json by ${moderator.username}`,
			content: fileContent,
			sha: fileLeaderboard.sha,
			branch: 'main'
		}, {
			headers: {
				Authorization: `token ${GITHUB_TOKEN}`
			}
		});
	},
	setRedisClientObject: (redisObj) => redisObject = redisObj
}