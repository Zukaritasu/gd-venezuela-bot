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

const logger = require('../../logger.js');
const { ChannelType } = require('discord.js');
const { COLL_PROFILES } = require('../../../.botconfig/database-info.json')

// Minimum allowed length for a Geometry Dash level name
const GD_LEVEL_NAME_MIN_LENGTH = 1;
// Maximum allowed length for a Geometry Dash level name
const GD_LEVEL_NAME_MAX_LENGTH = 20;
// Minimum allowed length for a Geometry Dash username
const GD_USERNAME_MIN_LENGTH = 3;
// Maximum allowed length for a Geometry Dash username
const GD_USERNAME_MAX_LENGTH = 15;

/**
 * Checks whether a buffer starts with the PNG file signature.
 *
 * @param {Buffer} buffer - The binary data to inspect.
 * @returns {boolean} Whether the buffer has a valid PNG signature.
 */
function isPNG(buffer) {
	if (buffer.length < 4) return false;
	return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
}

/**
 * Validates whether a value represents a non-negative integer or decimal number.
 *
 * In `INTEGER` mode, the value must contain between one and nineteen decimal
 * digits and must not exceed the maximum signed 64-bit integer. In `FLOAT`
 * mode, the value may contain a decimal fraction and must be between 0 and
 * 100, inclusive.
 *
 * @param {string|number} val - The value to validate. Leading and trailing
 *   whitespace is ignored.
 * @param {'INTEGER'|'FLOAT'} [type='INTEGER'] - The numeric format to validate.
 * @returns {boolean} `true` if the value matches the selected format;
 *   otherwise, `false`.
 */
function isValidNumber(val, type = 'INTEGER') {
    if (typeof val !== 'string' && typeof val !== 'number') return false;
    const str = String(val);
    if (str.trim() === '') return false;

    if (type === 'INTEGER') {
        if (!/^\d{1,19}$/.test(str))
            return false;
        if (str.length === 19 && str > '9223372036854775807')
            return false;
        return true;
    }

    if (type === 'FLOAT') {
        if (!/^\d+(\.\d+)?$/.test(str))
            return false;
        const num = Number(str);
        return Number.isFinite(num) && num >= 0 && num <= 100;
    }

    return false;
}

/**
 * Handles the POST request to upload a screenshot.
 * 
 * @param {import('express').Request} req - The incoming HTTP request
 * @param {import('express').Response} res - The outgoing HTTP response
 */
async function POST_screenshot(req, res) {
	if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
		return res.status(400).json({ error: 'Invalid or empty binary buffer' });
	}

	if (req.body.length > 8 * 1024 * 1024) {
		return res.status(400).json({ error: 'File size exceeds 8MB limit' });
	}

	const username = req.headers['x-username'];
	const accountId = req.headers['x-account-id'];
	const levelName = req.headers['x-level-name'];
	const levelId = req.headers['x-level-id'];
	const percent = req.headers['x-percent'];

	if ([username, accountId, levelName, levelId, percent]
		.some(h => !h || String(h).trim() === '')) {
		return res.status(400).json({ error: 'Missing required headers' });
	}

	if (!isPNG(req.body)) {
		return res.status(400).json({ error: 'File must be a valid PNG image' });
	}

	if (username.length < GD_USERNAME_MIN_LENGTH || username.length > GD_USERNAME_MAX_LENGTH ||
		!/^[a-zA-Z0-9_-]+$/.test(username)) {
		return res.status(400).json({ error: 'Invalid username' });
	}

	if (levelName.length < GD_LEVEL_NAME_MIN_LENGTH || levelName.length > GD_LEVEL_NAME_MAX_LENGTH ||
		!/^[a-zA-Z0-9_\-\s]+$/.test(levelName)) {
		return res.status(400).json({ error: 'Invalid levelName' });
	}

	if (!isValidNumber(accountId) || !isValidNumber(levelId) ||
		!isValidNumber(percent, 'FLOAT')) {
		return res.status(400).json({ error: 'accountId, levelId, and percent must be valid integers' });
	}

	try {
		const profile = await global.database.collection(COLL_PROFILES).findOne({ userId: req.userId })
		if (!profile?.channelId) {
			return res.status(400).json({
				error: 'Destination channel not found. Run the command /perfil mod destino in Discord server'
			});
		}

		const channelId = profile.channelId
		const safeLevelName = String(levelName).replace(/@/g, '');
		const parsedPercent = parseFloat(percent);
		const truncatedPercent = (Math.floor(parsedPercent * 100) / 100).toFixed(2);
		
		const channel = global.guild.channels.cache.get(channelId)
		if (!channel || channel.type !== ChannelType.GuildText) {
			return res.status(400).json({ error: 'Invalid channel' });
		}

		// async function to send the screenshot to the testing channel
		await channel.send({
			content: `<@${req.userId}> | Percent: ${truncatedPercent}% | Level name: ${safeLevelName} | Level ID: ${levelId}`,
			files: [{
				attachment: req.body,
				name: 'screenshot.png'
			}],
			allowedMentions: { users: [req.userId] }
		});
		res.json({ success: true });
	} catch (error) {
		logger.ERR(error);
		res.status(500).json({ error: 'Failed to process the screenshot' });
	}
}

module.exports = { POST_screenshot }