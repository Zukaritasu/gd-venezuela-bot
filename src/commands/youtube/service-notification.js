/**
 * Copyright (C) 2024 Zukaritasu
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

const { ChatInputCommandInteraction, Client, ChannelType } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../../logger');
const { YOUTUBE_API_KEY } = require('../../../.botconfig/token.json');

/**
 * Information about the Discord channel for service notifications.
 * @typedef {Object} DiscordChannelInfo
 * @property {string} channelId - The ID of the Discord channel.
 * @property {string} guildId - The ID of the Discord guild (server).
 */
const discordChannelInfo = {
    channelId: '1041060604850483404',
    guildId: '1037758697029513308',
}

/**
 * @param {string} channelId 
 * @returns 
 */
async function getLastVideo(channelId) {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=1`);
    if (response.ok) {
        const json = await response.json();
        if (json.items && json.items.length > 0) {
            return json.items[0];
        }
    }
    return null;
}

/**
 * @param {Db} db 
 * @param {Client} client 
 * @param {Object} channel 
 * @param {Object} video 
 */
async function notifyLastVideo(db, client, channel, video) {
    const videoPublishedAt = new Date(video.snippet.publishedAt);
    if (!channel.publishedAt || channel.publishedAt.length == 0 
                || videoPublishedAt > new Date(channel.publishedAt)) {
        const result = await db.collection('youtube_channels').updateOne(
            { _id: channel._id },
            {
                $set: {
                    publishedAt: video.snippet.publishedAt
                }
            });

        // Notify the video in the Discord channel
        // if the video was published in the last 24 hours
        if (result.modifiedCount > 0 && ((new Date() - videoPublishedAt) / (1000 * 60 * 60)) <= 24) {
            const channelInfo = await client.channels.fetch(discordChannelInfo.channelId);
            if (channelInfo && channelInfo.type === ChannelType.GuildText) {
                await channelInfo.send(channel.description
                    .replace('{video}', `https://youtu.be/${video.id.videoId}`)
                        .replace('{role}', `<@&${channel.mentionRoleId}>`)
                    .replace('{username}', channel.username)
                    .replace('\\n', '\n')
                )
            }
        }
    }
}

/**
 * @param {Db} db 
 * @param {Client} client 
 */
async function service(db, client) {
    const timeout = setInterval(async () => {
        try {
            const channels = await db.collection('youtube_channels').find({}).toArray();
            for (let i = 0; i < channels.length; i++) {
                const lastVideo = await getLastVideo(channels[i].channelId);
                if (lastVideo !== null) {
                    await notifyLastVideo(db, client, channels[i],
                        lastVideo);
                }
            }
        } catch (error) {
            logger.ERR(error);
        }
    }, 60000 /* 1 minute */);

    return {
        stop: () => clearInterval(timeout),

        description: 'Service to notify the last video of a YouTube channel',
        name: 'service-notification',
        fullname: 'YouTube Service Notification'
    }
}

module.exports = {
    start: service
}