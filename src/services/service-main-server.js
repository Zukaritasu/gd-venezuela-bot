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

const { Client } = require("discord.js");
const { Db } = require("mongodb");
const express = require('express');
const logger = require('../logger.js');
const { MAIN_SERVER_PORT, MOD_SCREENSHOT_SECRET } = require('../../.botconfig/token.json');
const { COLL_PROFILES_SESSIONS } = require('../../.botconfig/database-info.json');
const youtubeNotifications = require('./service-youtube-notifications.js');
const screenshot = require('./endpoints/screenshot.js');
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
		const exists = await global.database.collection(COLL_PROFILES_SESSIONS).findOne({ userId, token })

		if (!exists) {
			throw new Error('Session invalidated or expired');
		}

		req.userId = userId;
		next();
	} catch (error) {
		logger.DBG(error);
		res.status(401).json({ error: 'Invalid token' });
	}
}

/**
 * Starts the main HTTP server and registers the application's API endpoints.
 *
 * @param {Db} _db - The MongoDB database instance.
 * @param {Client} _client - The Discord.js client instance.
 * @returns {Promise<Object>} Service metadata and a function for stopping the server.
 */
async function service(_db, _client) {
	const app = express();

	const xmlParser = express.text({
		type: [
			'text/xml',
			'application/xml',
			'application/atom+xml',
			'text/plain'
		]
	});

	const rawParser = express.raw({
		type: 'application/octet-stream',
		limit: '8mb'
	});

	// YouTube notifications service
	app.get('/youtube-webhook', youtubeNotifications.GET_verifyWebhook);
	app.post('/youtube-webhook', xmlParser, youtubeNotifications.POST_youtubeWebhook);

	// Geometry Dash Mod Screenshot Service
	app.post('/screenshot', verifyToken, rawParser, screenshot.POST_screenshot);

	const serverInstance = app.listen(MAIN_SERVER_PORT, '127.0.0.1', () => {
		logger.INF(`Main server listening on port ${MAIN_SERVER_PORT}`);
	});

	return {
		stop: () => {
			if (serverInstance) {
				serverInstance.close((err) => {
					if (err) logger.ERR(err);
				});
			}
		},

		description: 'Service Main server for handling various API endpoints',
		name: 'service-main-server',
		fullname: 'Main Server Service'
	}
}

module.exports = { start: service }