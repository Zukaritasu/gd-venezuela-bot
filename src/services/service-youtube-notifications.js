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
const crypto = require('crypto')
const logger = require('../logger.js');
const utils = require('../utils.js');
const youtubeApi = require('../youtubeapi.js');
const { YOUTUBE_NOTIFICATIONS, BOT_TESTING } = require('../../.botconfig/channels.json')
const { COLL_YOUTUBE_CHANNELS, COLL_YOUTUBE_VIDEOS } = require('../../.botconfig/database-info.json')
const { PUBLIC_IP, YOUTUBE_NOTIFICATIONS_PORT, YOUTUBE_API_KEY, YOUTUBE_WEBHOOK_SECRET } = require('../../.botconfig/token.json')
const notifications = require('../commands/youtube/notifications.js')
const { XMLParser } = require('fast-xml-parser');

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
 * @property {string[]} videoFilter
 * @property {boolean} isEnabled
 * @property {number} datetimeSub
 */

/**
 * @typedef {Object} YouTubeVideo
 * 
 * @property {string} videoId - YouTube video ID
 * @property {string} channelId - YouTube channel ID
 * @property {string} title - Video title
 * @property {number} published - Publication date
 * @property {number} updated - Update date
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
async function autoUpdateSubscription() {
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
 * 
 * @param {YouTubeVideo} videoInfo 
 * @returns {Promise<void>}
 */
async function sendNewVideo(videoInfo, isStream) {
    /** @type {YouTubeChannel} */
    const youtubeChannel = await globalRef.database.collection(COLL_YOUTUBE_CHANNELS).findOne({
        channelId: videoInfo.channelId
    });

    if (await saveVideo(videoInfo) && youtubeChannel && youtubeChannel.isEnabled) {
        /** @type {TextChannel} */
        const channel = globalRef.guild.channels.cache.get(YOUTUBE_NOTIFICATIONS);
        if (!channel || youtubeChannel?.videoFilter.some(item => videoInfo.title.toLowerCase().includes(item.toLowerCase())))
            return

        logger.DBG(`Video sended: ${videoInfo.videoId}`)
        if (videoInfo.channelId !== 'UCdwIt6BJez93HG-rxNnttNw') {
            await channel.send(`<@&${process.env.ID_ROL_YOUTUBE_NOTIFICACIONES}>\n${isStream ? youtubeChannel.commentNewStream : youtubeChannel.commentNewVideo
                } https://youtu.be/${videoInfo.videoId}`);
        }
    }
}

/**
 * Saves a YouTube video to the database if it hasn't been registered before.
 * 
 * A video is considered valid for notification if:
 * - It doesn't exist in the database yet (prevents duplicate notifications).
 * 
 * @param {YouTubeVideo} videoInfo - The video information to check and save.
 * @param {string} videoInfo.videoId - The unique identifier of the video.
 * @param {string} videoInfo.channelId - The identifier of the channel that published the video.
 * @returns {Promise<boolean>} True if the video was successfully saved (new video), false
 * if it already existed or an error occurred.
 */
async function saveVideo(videoInfo) {
    try {
        const video = await globalRef.database.collection(COLL_YOUTUBE_VIDEOS).findOne(
            { videoId: videoInfo.videoId })

        if (video) return false

        await globalRef.database.collection(COLL_YOUTUBE_VIDEOS).insertOne(
            {
                channelId: videoInfo.channelId,
                videoId: videoInfo.videoId
            }
        )

        return true
    } catch (error) {
        logger.ERR(error)

        return false
    }
}
/**
 * Parses an XML entry object from a YouTube video feed and converts it to a YouTubeVideo object.
 * 
 * Handles both direct property access and nested `#text` properties commonly returned by XML parsers.
 * All fields default to `null` if the corresponding data is not found in the entry.
 * 
 * @param {Object} entry - The XML entry object from the YouTube feed parser
 * @param {string} entry.yt_videoId - The YouTube video ID (accessed via entry["yt:videoId"])
 * @param {string} entry.yt_channelId - The YouTube channel ID (accessed via entry["yt:channelId"])
 * @param {string} entry.title - The video title
 * @param {string} entry.published - The publication date in ISO 8601 format
 * @param {string} entry.updated - The update date in ISO 8601 format
 * @returns {YouTubeVideo} A normalized YouTubeVideo object with all fields parsed
 * 
 * @example
 * const entry = {
 *   "yt:videoId": "W_cgWNeypDY",
 *   "yt:channelId": "UCeI6lBecLZ57HDs8lYarksw",
 *   title: "48-100",
 *   published: "2026-07-11T18:24:28+00:00",
 *   updated: "2026-07-11T18:24:31.728600305+00:00"
 * };
 * 
 * const video = parseEntryToYouTubeVideo(entry);
 * // Returns:
 * // {
 * //   videoId: "W_cgWNeypDY",
 * //   channelId: "UCeI6lBecLZ57HDs8lYarksw",
 * //   title: "48-100",
 * //   published: 1752265468000,
 * //   updated: 1752265471728
 * // }
 */
function parseEntryToYouTubeVideo(entry) {
    const getValue = (field) => {
        const value = entry?.[field] ?? entry?.[field]?.['#text'] ?? null;
        return value;
    };

    const getDate = (field) => {
        const value = entry?.[field] ?? entry?.[field]?.['#text'] ?? null;
        return value ? new Date(value).getTime() : null;
    };

    return {
        videoId: getValue('yt:videoId'),
        channelId: getValue('yt:channelId'),
        title: getValue('title'),
        published: getDate('published'),
        updated: getDate('updated')
    };
}

/**
 * Verify the incoming PubSubHubbub (YouTube webhook) request signature.
 *
 * Computes the HMAC-SHA1 of the raw request body using the provided secret
 * and compares it to the value in the `X-Hub-Signature` header in a
 * timing-safe manner.
 *
 * @param {string|Buffer} body - Raw request body as received (string or Buffer).
 * @param {string} signatureHeader - Value of the `X-Hub-Signature` header (format: "sha1=<hex>").
 * @param {string} secret - Shared secret used to compute the HMAC.
 * @returns {boolean} True if the signature is valid, false otherwise.
 */
function verifyHubSignature(body, signatureHeader, secret) {
    if (!signatureHeader || !secret) return false;

    try {
        const parts = signatureHeader.split('=');
        if (parts.length !== 2 || parts[0] !== 'sha1')
            return false;

        const expectedHash = parts[1];

        const hmac = crypto.createHmac('sha1', secret);
        hmac.update(body, 'utf8');
        const computedHash = hmac.digest('hex');

        const expectedBuffer = Buffer.from(expectedHash, 'hex');
        const computedBuffer = Buffer.from(computedHash, 'hex');

        if (expectedBuffer.length !== computedBuffer.length)
            return false; 

        return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
    } catch (error) {
        logger.ERR(error)
    }

    return false
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
        if (!verifyHubSignature(req.body, req.headers['x-hub-signature'], YOUTUBE_WEBHOOK_SECRET)) {
            logger.ERR('Verify Hub Signature failed', { 
                headers: req.headers 
            })
            return res.status(403).end();
        }

        const jsonObj = parser.parse(req.body);
        const entries = Array.isArray(jsonObj.feed?.entry)
            ? jsonObj.feed.entry
            : jsonObj.feed?.entry ? [jsonObj.feed.entry] : [];

        for (const entry of entries) {
            const videoInfo = parseEntryToYouTubeVideo(entry)

            logger.DBG(`New video/stream: ${videoInfo.videoId}`)

            if (!videoInfo.published || !videoInfo.updated || !videoInfo.videoId || !videoInfo.channelId)
                continue;

            const videoItem = await youtubeApi.fetchVideoDetails(videoInfo.videoId)
            if (videoItem) {
                const videoType = await youtubeApi.getVideoType(videoItem)
                if (videoType) {
                    if (videoType === 'stream' && videoItem.snippet?.liveBroadcastContent !== 'live')
                        continue
                    await sendNewVideo(videoInfo, videoType === 'stream')
                }
            }
        }
    } catch (error) {
        logger.ERR(error);
        
    }

    res.status(200).end();
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
            'application/atom+xml',
            'text/plain'
        ]
    }));

    app.get('/youtube-webhook', GET_verifyWebhook);
    app.post('/youtube-webhook', POST_youtubeWebhook);

    const serverInstance = app.listen(YOUTUBE_NOTIFICATIONS_PORT, '0.0.0.0', () => {
        logger.INF(`YouTube notifications service listening on port ${YOUTUBE_NOTIFICATIONS_PORT}`);
    });

    const timeout = setInterval(autoUpdateSubscription, 1000 * 60 * 60); // 1 hour

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