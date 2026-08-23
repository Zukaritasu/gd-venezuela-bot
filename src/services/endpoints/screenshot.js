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
const utils = require('../../utils.js');
const express = require('express');
const sharp = require('sharp');
const crypto = require('crypto')
const { MOD_SCREENSHOT_SECRET } = require('../../../.botconfig/token.json');
const { BOT_TESTING } = require('../../../.botconfig/channels.json');
const { COLL_PROFILES } = require('../../../.botconfig/database-info.json');
const { Client } = require('discord.js');
const jwt = require('jsonwebtoken');

/**
 * Middleware to verify the JWT token in the request headers.
 * 
 * @param {import('express').Request} req - The incoming HTTP request
 * @param {import('express').Response} res - The outgoing HTTP response
 * @param {import('express').NextFunction} next - The next middleware function
 */
async function verifyToken(req, res, next) {
	const token = req.headers['authorization']?.split(' ')[1];

	if (!token) {
		return res.status(401).json({ error: 'No token provided' });
	}

	try {
		const payload = jwt.verify(token, MOD_SCREENSHOT_SECRET);
		if (!('u' in payload)) {
			throw new Error('Payload not found');
		}

		const userId = payload.u.toString()
		const exists = await global.database.collection(COLL_PROFILES).findOne({ userId })

		if (!exists) {
			throw new Error('Invalid token');
		}

		req.userId = userId;
		next();
	} catch (error) {
		logger.ERR(error);
		res.status(401).json({ error: 'Invalid token' });
	}
}

/**
 * Checks whether a value represents a non-negative integer / float.
 *
 * @param {string|number} val - The value to validate.
 * @param {'INTEGER' | 'FLOAT'} type 
 * @returns {boolean} Whether the value is a valid non-negative integer / float.
 */
function isValidNumber(val, type = 'INTEGER') {
    if (typeof val !== 'string' && typeof val !== 'number') return false;
    const str = String(val).trim();
    if (str === '') return false;
    
    const num = Number(str);
    return (type === 'INTEGER' ?  Number.isInteger(num) : Number.isFinite(num)) && num >= 0;
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

	const username = req.headers['x-username'];
	const accountId = req.headers['x-account-id'];
	const levelName = req.headers['x-level-name'];
	const levelId = req.headers['x-level-id'];
	const percent = req.headers['x-percent'];

	if ([username, accountId, levelName, levelId, percent]
		.some(h => !h || String(h).trim() === '')) {
		return res.status(400).json({ error: 'Missing required headers' });
	}

	if (!isValidNumber(accountId) || !isValidNumber(levelId) || !isValidNumber(percent, 'FLOAT')) {
        return res.status(400).json({ error: 'accountId, levelId, and percent must be valid integers' });
    }

	//const parsedAccountId = parseInt(accountId, 10);
    const parsedLevelId = parseInt(levelId, 10);
	const parsedPercent = parseFloat(percent);

	try {
		const safeLevelName = String(levelName).replace(/@/g, '');
		const truncatedPercent = (Math.floor(parsedPercent * 100) / 100).toFixed(2);
		
		// async function to send the screenshot to the testing channel
		await global.guild.channels.cache.get(BOT_TESTING)?.send({
			content: `<@${req.userId}> | Percent: ${truncatedPercent}% | Level name: ${safeLevelName} | Level ID: ${parsedLevelId}`,
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

module.exports = { verifyToken, POST_screenshot }