/**
 * Copyright (C) 2026 Zukaritasu
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

const { Client, TextChannel, Guild } = require("discord.js");
const { Db } = require("mongodb");
const express = require('express');
const axios = require('axios')
const logger = require('../logger.js');
const utils = require('../utils.js');
const { YOUTUBE_NOTIFICATIONS, BOT_TESTING } = require('../../.botconfig/channels.json')
const { COLL_YOUTUBE_CHANNELS, COLL_CONFIG } = require('../../.botconfig/database-info.json')
const { PUBLIC_IP, YOUTUBE_NOTIFICATIONS_PORT } = require('../../.botconfig/token.json')
const { XMLParser } = require('fast-xml-parser');
const notifications = require('../commands/youtube/notifications.js')

const parser = new XMLParser();

const app = express();

/**
 * @type {globalThis & { database: Db, guild: Guild }}
 */
const globalRef = global;

/**
 * @typedef {Object} YouTubeChannel
 * 
 * @property {string} userId
 * @property {string} channelName
 * @property {string} channelId
 * @property {string} commentNewVideo
 * @property {string} commentNewStream
 * @property {boolean} isEnabled
 * @property {number} datetimeSub
 */

/**
 * Refreshes YouTube channel subscriptions for the webhook listener.
 *
 * This function retrieves all stored YouTube channels from the database,
 * and sends a subscription request to the PubSubHubbub hub for each one.
 * It uses the configured public IP and port to build the callback URL and
 * waits briefly between requests to avoid overwhelming the hub.
 *
 * @returns {Promise<void>} Resolves when all subscription requests are sent.
 */
async function autoUpdateSuscription() {
    const webhookUrl = `http://${PUBLIC_IP}:${YOUTUBE_NOTIFICATIONS_PORT}/youtube-webhook`
    
    /** @type {YouTubeChannel[]} */
    const youtubeChannels = await globalRef.database.collection(COLL_YOUTUBE_CHANNELS).find().toArray()
    
    for (const channel of youtubeChannels) {
        if (!channel.isEnabled) continue;

        const threeDaysMs = 259200000;
        const timeElapsed = Date.now() - channel.datetimeSub;

        if (timeElapsed >= threeDaysMs) {
            const success = await notifications.subscribeUnsubscribe(webhookUrl, channel.channelId, true)
            if (success) {
                await globalRef.database.collection(COLL_YOUTUBE_CHANNELS).updateOne(
                    { userId: channel.userId },
                    { $set: { datetimeSub: Date.now() } }
                )
            }
            
            await utils.sleep(500)
        }
    }
}

/**
 * Validate the YouTube PubSubHubbub webhook subscription request.
 *
 * The YouTube webhook verification sends a GET request with a
 * `hub.challenge` query parameter. This function responds with the
 * challenge token when present, allowing the webhook subscription to
 * be confirmed.
 *
 * @param {import('express').Request} req - The incoming HTTP request.
 * @param {import('express').Response} res - The outgoing HTTP response.
 * @returns {Promise<import('express').Response>} HTTP response with the
 * challenge token or an error status.
 */
async function GET_verifyWebhook(req, res) {
	const challenge = req.query['hub.challenge'];
	if (challenge) {
		return res.status(200).send(challenge);
	}
	res.status(400).send('No challenge found');
}

/**
 * Handle incoming YouTube PubSubHubbub notifications.
 *
 * This endpoint receives POST requests from YouTube when a subscribed
 * channel publishes new content. The request body may contain XML payloads
 * describing the video event.
 *
 * @param {import('express').Request} req - The incoming HTTP request.
 * @param {import('express').Response} res - The outgoing HTTP response.
 * @returns {Promise<void>} Responds to the webhook notification.
 */
async function POST_youtubeWebhook(req, res) {
    try {
        const jsonObj = parser.parse(req.body);

        logger.DBG(JSON.stringify(req.body));
        
        const entries = Array.isArray(jsonObj.feed?.entry) 
            ? jsonObj.feed.entry 
            : jsonObj.feed?.entry ? [jsonObj.feed.entry] : [];

        for (const entry of entries) {
            logger.DBG(JSON.stringify(entry));

            const videoId = entry['yt:videoId'];
            const channelId = entry['yt:channelId'];
            
            if (!videoId || !channelId) continue;

            const published = new Date(entry.published).getTime();
            const updated = new Date(entry.updated).getTime();
            
            const oneHourMs = 1000 * 60 * 60;
            if (Date.now() - published > oneHourMs) {
                logger.DBG(`Ignorando video ${videoId} porque es una edición o contenido antiguo.`);
                continue;
            }

            /** @type {YouTubeChannel} */
            const youtubeChannel = await globalRef.database.collection(COLL_YOUTUBE_CHANNELS)
                .findOne({ channelId });

            if (youtubeChannel) {
                /** @type {TextChannel} */
                const channel = globalRef.guild.channels.cache.get(BOT_TESTING);
                if (channel) {
                    await channel.send(`<@&1266941869120684032>\n${youtubeChannel.commentNewVideo} https://youtu.be/${videoId}`);
                }
            }
        }

        res.status(200).end();
    } catch (error) {
        logger.ERR(error);
        res.status(200).end();
    }
}

/**
 * Initializes the YouTube notifications service.
 * 
 * Fetches the target Discord guild, sets up the Express server with proper 
 * XML and text body parsers, registers webhook verification and delivery endpoints, 
 * and starts the automated subscription renewal routine.
 * 
 * @param {Db} _db - The MongoDB database instance.
 * @param {Client} client - The DiscordJS client instance.
 * @returns {Promise<{ stop: Function, description: string, name: string, fullname: string }>}
 * An object representing the service control interface.
 */
async function service(_db, client) {
	const guild = await client.guilds.fetch(process.env.SERVER_GD_VENEZUELA_ID);
	if (!guild) {
		throw new Error(`Guild not found ${process.env.SERVER_GD_VENEZUELA_ID}`);
	}

	globalRef.guild = guild

	app.use(express.text({
		type: [
			'text/xml',
			'application/xml',
			'text/plain'
		]
	}));

	app.get('/youtube-webhook', GET_verifyWebhook);
	app.post('/youtube-webhook', POST_youtubeWebhook);

	const serverInstance = app.listen(YOUTUBE_NOTIFICATIONS_PORT, '0.0.0.0', () => {
		logger.INF(`YouTube notifications service listening on port ${YOUTUBE_NOTIFICATIONS_PORT}`);
	});

	const timeout = setInterval(autoUpdateSuscription, 1000 * 60 * 60); // 1 hour

	return {
		stop: () => {
			if (serverInstance) {
				serverInstance.close((err) => {
                    if (err) logger.ERR(err);
                });
			}

			clearInterval(timeout)
		},

		description: 'Service YouTube notifications for new videos from subscribed channels',
		name: 'service-youtube-notifications',
		fullname: 'YouTube Notifications Service'
	}
}

module.exports = { start: service }