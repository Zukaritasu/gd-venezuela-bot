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
const { Client } = require('discord.js');
const jwt = require('jsonwebtoken');

/**
 * Middleware to verify the JWT token in the request headers.
 * 
 * @param {import('express').Request} req - The incoming HTTP request
 * @param {import('express').Response} res - The outgoing HTTP response
 * @param {import('express').NextFunction} next - The next middleware function
 */
function verifyToken(req, res, next) {
	const token = req.headers['authorization']?.split(' ')[1];

	if (!token) {
		return res.status(401).json({ error: 'No token provided' });
	}

	try {
		const decoded = jwt.verify(token, MOD_SCREENSHOT_SECRET);
		req.user = decoded;
		next();
	} catch (error) {
		logger.ERR('Invalid token');
		res.status(401).json({ error: 'Invalid token' });
	}
}

/**
 * Handles the POST request to upload a screenshot.
 * 
 * @param {import('express').Request} req - The incoming HTTP request
 * @param {import('express').Response} res - The outgoing HTTP response
 */
async function POST_screenshot(req, res) {
	const rawWidth = req.headers['x-image-width']
	const rawHeight = req.headers['x-image-height'];
	const username = req.headers['x-username'];
	const accountId = req.headers['x-account-id'];
	const percentage = req.headers['x-percentage'];

	if ([rawWidth, rawHeight, username, accountId, percentage].some(h => !h || String(h).trim() === '')) {
		return res.status(400).json({ error: 'Missing required headers' });
	}

	const width = parseInt(rawWidth);
	const height = parseInt(rawHeight);

	const pngBuffer = await sharp(req.body, {
		raw: {
			width,
			height,
			channels: 4
		}
	}).png().toBuffer();

	try {
		// async function to send the screenshot to the testing channel
		global.guild.channels.cache.get(BOT_TESTING)?.send({
			files: [{
				attachment: pngBuffer,
				name: 'screenshot.png'
			}]
		});
		res.json({ success: true });
	} catch (error) {
		logger.ERR(error);
	}

	res.status(500).json({ error: 'Failed to process the screenshot' });
}

module.exports = { verifyToken, POST_screenshot }