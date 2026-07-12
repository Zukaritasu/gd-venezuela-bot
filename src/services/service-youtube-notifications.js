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
const { COLL_YOUTUBE_CHANNELS, COLL_CONFIG, COLL_YOUTUBE_VIDEOS } = require('../../.botconfig/database-info.json')
const { PUBLIC_IP, YOUTUBE_NOTIFICATIONS_PORT, YOUTUBE_API_KEY } = require('../../.botconfig/token.json')
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

    if (youtubeChannel && youtubeChannel.isEnabled) {
        /** @type {TextChannel} */
        const channel = globalRef.guild.channels.cache.get(BOT_TESTING);
        if (channel) {
            await channel.send(`<@&${process.env.ID_ROL_YOUTUBE_NOTIFICACIONES}>\n${
                isStream ? youtubeChannel.commentNewStream : youtubeChannel.commentNewVideo
            } https://youtu.be/${videoInfo.videoId}`);
        }
    }
}

/**
 * Checks if a YouTube video is valid for notification.
 * A video is considered valid if:
 * - It was published within the last hour
 * - It hasn't been notified before (not in database)
 * 
 * @param {YouTubeVideo} videoInfo - The video information to validate
 * @returns {Promise<boolean>} True if the video is valid and should be notified
 */
async function isVideoValid(videoInfo) {
    const ONE_HOUR_MS = 1000 * 60 * 60;
    const now = Date.now();

    if (now - videoInfo.published > ONE_HOUR_MS) {
        logger.DBG(`Ignoring video ${videoInfo.videoId} because it is an older version or outdated content`);
        return false;
    }

    try {
        // Check if video already exists in database (already notified)
        const video = await globalRef.database.collection(COLL_YOUTUBE_VIDEOS).findOne(
            { videoId: videoInfo.videoId })

        if (video) return false

        // Mark video as notified by inserting into database
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
 * Converts ISO 8601 duration to seconds.
 * 
 * @param {string} duration - ISO 8601 duration string (e.g., 'PT1M30S')
 * @returns {number} Duration in seconds
 * 
 * @example
 * parseDurationToSeconds('PT1M30S') // 90
 * parseDurationToSeconds('PT45S') // 45
 */
function parseDurationToSeconds(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Determines the type of a YouTube video (short, video, or stream).
 * 
 * This function uses a multi-step approach:
 * 1. Fetches video details from YouTube API to check for live streams and duration
 * 2. If duration ≤ 60 seconds, verifies if it's a Short by checking the /shorts/ URL
 * 3. Returns null if the video type cannot be determined (API errors, network issues, etc.)
 * 
 * @param {YouTubeVideo} videoInfo - The video information object containing the videoId
 * @param {string} videoInfo.videoId - The YouTube video ID
 * @returns {Promise<'short' | 'video' | 'stream' | null>} 
 *          - 'short': The video is a YouTube Short
 *          - 'video': The video is a regular video (not a Short or stream)
 *          - 'stream': The video is a live stream or upcoming stream
 *          - null: The video type could not be determined (API error, network issue, etc.)
 * 
 * @example
 * const type = await getVideoType({ videoId: 'iUBO9exdK5s' });
 * if (type === 'short') {
 *   logger.INF('This is a YouTube Short');
 * } else if (type === null) {
 *   logger.INF('Could not determine video type');
 * }
 */
async function getVideoType(videoInfo) {
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                id: videoInfo.videoId,
                part: 'snippet,contentDetails,liveStreamingDetails',
                key: YOUTUBE_API_KEY
            }
        });

        const video = response.data?.items?.[0];

        if (!video) return null;

        if (video.snippet?.liveBroadcastContent === 'live' ||
            video.snippet?.liveBroadcastContent === 'upcoming' ||
            video.liveStreamingDetails) {
            return 'stream';
        }

        const duration = video.contentDetails?.duration;
        const durationSeconds = duration ? parseDurationToSeconds(duration) : 0;

        if (durationSeconds > 60) return 'video';

        const headResponse = await axios.head(`https://www.youtube.com/shorts/${videoInfo.videoId}`, {
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
        });

        if (headResponse.status >= 200 && headResponse.status < 300)
            return 'short';
        else if (headResponse.status >= 300 && headResponse.status < 400)
            return 'video';
    } catch (error) {
        logger.ERR(error)
    }

    return null
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
        const entries = Array.isArray(jsonObj.feed?.entry)
            ? jsonObj.feed.entry
            : jsonObj.feed?.entry ? [jsonObj.feed.entry] : [];

        for (const entry of entries) {
            const videoInfo = parseEntryToYouTubeVideo(entry)

            if (!videoInfo.published || !videoInfo.updated || !videoInfo.videoId ||
                !videoInfo.channelId || !await isVideoValid(videoInfo))
                continue;

            const videoType = await getVideoType(videoInfo)
            if (videoType && videoType !== 'short') {
                await sendNewVideo(videoInfo, videoType === 'stream')
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