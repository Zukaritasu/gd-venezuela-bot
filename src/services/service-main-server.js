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
const { MAIN_SERVER_PORT } = require('../../.botconfig/token.json');
const youtubeNotifications = require('./service-youtube-notifications.js');
const screenshot = require('./endpoints/screenshot.js');

/**
 * Starts the main HTTP server and registers the application's API endpoints.
 *
 * @param {Db} _db - The MongoDB database instance.
 * @param {Client} client - The Discord.js client instance.
 * @returns {Promise<Object>} Service metadata and a function for stopping the server.
 */
async function service(_db, client) {
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
		limit: '20mb'
	});

	// YouTube notifications service
	app.get('/youtube-webhook', youtubeNotifications.GET_verifyWebhook);
	app.post('/youtube-webhook', xmlParser, youtubeNotifications.POST_youtubeWebhook);

	// Geometry Dash Mod Screenshot Service
	app.post('/screenshot', rawParser, screenshot.verifyToken, screenshot.POST_screenshot);

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