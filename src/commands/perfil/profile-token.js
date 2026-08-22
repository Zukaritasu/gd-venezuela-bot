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
const { Db } = require("mongodb");
const logger = require('../../logger')
const { COLL_PROFILES } = require('../../../.botconfig/database-info.json')
const { MOD_SCREENSHOT_SECRET } = require('../../../.botconfig/token.json')
const jwt = require('jsonwebtoken');

/**
 * Generates or retrieves the authenticated user's Screenshot Mod login token.
 *
 * Access is restricted to members with the role configured by
 * `ID_ROL_NOTABLE`. If the user's token is missing or invalid, this function
 * creates a new JWT with a 90-day lifetime and stores it in the profiles
 * collection. A valid existing token is reused instead.
 *
 * The token is returned in an ephemeral Discord reply, making it visible only
 * to the requesting user. Errors are logged and reported with a generic
 * message without exposing internal details.
 *
 * @param {Db} database MongoDB database connection used to access profiles.
 * @param {ChatInputCommandInteraction} interaction Discord interaction used
 *   to authorize the user and send the response.
 * @returns {Promise<void>} Resolves after the token or an error message is
 *   sent to the user.
 */
async function generateToken(database, interaction) {
	try {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const requiredRoleId = process.env.ID_ROL_NOTABLE;
		if (!interaction.member.roles.cache.has(requiredRoleId)) {
			return await interaction.editReply('Usuario no autorizado');
		}

		const userId = interaction.member.id;
		
		let profile = await database.collection(COLL_PROFILES).findOne({ userId });
		let currentToken = profile?.token;
		let isInvalid = !currentToken;

		if (currentToken) {
			try {
				jwt.verify(currentToken, MOD_SCREENSHOT_SECRET);
			} catch (error) {
				const expectedErrors = ['TokenExpiredError', 'JsonWebTokenError'];
				if (!expectedErrors.includes(error?.name)) {
					logger.ERR(error);
				}
				isInvalid = true;
			}
		}

		if (isInvalid) {
			currentToken = jwt.sign({ u: userId }, MOD_SCREENSHOT_SECRET, { expiresIn: '90d' });

			await database.collection(COLL_PROFILES).updateOne(
				{ userId },
				{ $set: { userId, token: currentToken } },
				{ upsert: true }
			);
		}

		await interaction.editReply(
			`Este es tu token de inicio de sesión en el Mod de Screenshot:\n` +
			`\`\`\`${currentToken}\`\`\`\n` +
			`-# No compartas el token con nadie! Si el token fue vulnerado, avísale a Zuka. El token tiene 90 días antes de expirar.`
		);

	} catch (error) {
		logger.ERR(error);
		try {
			await interaction.editReply('Ha ocurrido un error inesperado. Intenta más tarde.');
		} catch {
			
		}
	}
}

module.exports = {
	generateToken
};