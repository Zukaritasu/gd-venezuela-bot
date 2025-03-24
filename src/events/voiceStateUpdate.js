const { Events, VoiceState, Client, ChannelType } = require('discord.js');
const logger = require('../logger')

const AFK_CHANNEL_ID = '1268126026974629919';

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,
    /**
     * Handles the voice state update event.
     *
     * @param {Client} _client - The Discord client instance.
     * @param {Db} _database - The database instance.
     * @param {VoiceState} oldState - The previous voice state.
     * @param {VoiceState} newState - The new voice state.
     * @returns {Promise<void>}
     */
    async execute(_client, _database, oldState, newState) {
        if (newState.channelId === AFK_CHANNEL_ID && oldState.channelId !== AFK_CHANNEL_ID) {

            setTimeout(async () => {
                if (newState.channelId === AFK_CHANNEL_ID) {
                    try {
                        await newState.member.voice.disconnect();
                    } catch (error) {
                        logger.DBG(`Failed to disconnect user ${newState.member.user.tag}: ${error.message}`);
                    }
                }
            }, 300000 /* 5 minutes */);
        }
    },

    /**
     * Scans the target voice channel for users and disconnects them immediately.
     *
     * @param {Client} client - The Discord client instance.
     * @returns {Promise<void>}
     */
    async scanAndDisconnectUsers(client) {
        const channel = client.channels.cache.get(AFK_CHANNEL_ID);
        
        if (channel && channel.type === ChannelType.GuildVoice) {
            for (const [memberId, member] of channel.members) {
                try {
                    await member.voice.disconnect();
                } catch (error) {
                    logger.DBG(`Failed to disconnect user ${member.user.tag}: ${error.message}`);
                }
            }
        } else {
            logger.DBG(`Channel with ID ${AFK_CHANNEL_ID} not found or is not a voice channel`);
        }
    }
};