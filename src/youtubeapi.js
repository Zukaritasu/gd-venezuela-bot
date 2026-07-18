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

const axios = require('axios')
const logger = require('./logger')
const { YOUTUBE_API_KEY } = require('../.botconfig/token.json')

/**
 * @typedef {Object} YouTubeVideoItem
 * @property {"youtube#video"} kind
 * @property {string} etag
 * @property {string} id
 * @property {Object} [snippet]
 * @property {string} snippet.publishedAt
 * @property {string} snippet.channelId
 * @property {string} snippet.title
 * @property {string} snippet.description
 * @property {Object.<string, Object>} snippet.thumbnails
 * @property {string} snippet.channelTitle
 * @property {string[]} [snippet.tags]
 * @property {string} snippet.categoryId
 * @property {"none"|"upcoming"|"live"} snippet.liveBroadcastContent
 * @property {Object} snippet.localized
 * @property {string} snippet.localized.title
 * @property {string} snippet.localized.description
 * @property {Object} [contentDetails]
 * @property {string} contentDetails.duration
 * @property {string} contentDetails.dimension
 * @property {"hd"|"sd"} contentDetails.definition
 * @property {"true"|"false"} contentDetails.caption
 * @property {boolean} contentDetails.licensedContent
 * @property {"rectangular"|"360"} contentDetails.projection
 * @property {Object} [status]
 * @property {"deleted"|"failed"|"processed"|"rejected"|"uploaded"} status.uploadStatus
 * @property {"public"|"unlisted"|"private"} status.privacyStatus
 * @property {"youtube"|"creativeCommon"} status.license
 * @property {boolean} status.embeddable
 * @property {boolean} status.publicStatsViewable
 * @property {boolean} status.madeForKids
 * @property {Object} [statistics]
 * @property {string} statistics.viewCount
 * @property {string} [statistics.likeCount]
 * @property {string} statistics.favoriteCount
 * @property {string} [statistics.commentCount]
 * @property {Object} [liveStreamingDetails]
 * @property {string} [liveStreamingDetails.actualStartTime]
 * @property {string} [liveStreamingDetails.actualEndTime]
 * @property {string} [liveStreamingDetails.scheduledStartTime]
 * @property {string} [liveStreamingDetails.concurrentViewers]
 */

/**
 * Fetches detailed information for a specific YouTube video from the
 * YouTube Data API.
 * Requests extended metadata including snippet, content details, live streaming
 * data, statistics, and status.
 * 
 * @param {string} videoId - The unique identifier of the YouTube video.
 * @returns {Promise<YouTubeVideoItem | null>} The video data object if found, or
 * null if the video doesn't exist or an error occurs.
 */
async function fetchVideoDetails(videoId) {
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                id: videoId,
                part: 'snippet,contentDetails,liveStreamingDetails,statistics,status',
                key: YOUTUBE_API_KEY
            }
        });

        const videoItem = response.data?.items?.[0] ?? null;
        if (videoItem) {
            logger.DBG(JSON.stringify(videoItem))
        }

        return videoItem;
    } catch (error) {
        logger.ERR(`Error fetching video details for ${videoId}:`, error);
        return null;
    }
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
 * @param {YouTubeVideoItem} videoItem - The video information object containing the video id
 * @returns {Promise<'short' | 'video' | 'stream' | null>} 
 *          - 'short': The video is a YouTube Short
 *          - 'video': The video is a regular video (not a Short or stream)
 *          - 'stream': The video is a live stream or upcoming stream
 *          - null: The video type could not be determined (API error, network issue, etc.)
 * 
 * @example
 * const type = await getVideoType(videoItem);
 * if (type === 'short') {
 *   logger.INF('This is a YouTube Short');
 * } else if (type === null) {
 *   logger.INF('Could not determine video type');
 * }
 */
async function getVideoType(videoItem) {
    try {
        if (videoItem.snippet?.liveBroadcastContent === 'live' ||
            videoItem.snippet?.liveBroadcastContent === 'upcoming' ||
            videoItem.liveStreamingDetails) {
            return 'stream';
        }

        const duration = videoItem.contentDetails?.duration;
        const durationSeconds = duration ? parseDurationToSeconds(duration) : 0;

        if (durationSeconds > 60) return 'video';

        const headResponse = await axios.head(`https://www.youtube.com/shorts/${videoItem.id}`, {
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

module.exports = { fetchVideoDetails, getVideoType }