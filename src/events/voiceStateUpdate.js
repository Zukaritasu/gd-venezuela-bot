const { Events, VoiceState, Client, ChannelType, GuildMember } = require('discord.js');
const logger = require('../logger')

const AFK_CHANNEL_ID = '1268126026974629919';

const timeoutList = new Map();

function deleteTimeout(userId) {
    const timeout = timeoutList.get(userId);
    if (timeout) {
        clearTimeout(timeout);
        timeoutList.delete(userId);
    }
}

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
        /*if (newState.member === null || newState.member.user.id !== '591640548490870805') {
            return;
        }*/

        /*if (newState.channelId === AFK_CHANNEL_ID && oldState.channelId !== AFK_CHANNEL_ID) {
            deleteTimeout(newState.member.id);
            timeoutList.set(newState.member.id, setTimeout(async () => {
                try {
                    await newState.member.voice.disconnect('User idle for 5 minutes');
                } catch (error) {
                    logger.DBG(`Failed to disconnect user ${newState.member.user.tag}: ${error.message}`);
                }
            }, 300000 )); // 5 minutes
        } else if (newState.channelId === null) {
            // User left the voice channel
            deleteTimeout(newState.member.id);
        } else if (newState.channelId !== AFK_CHANNEL_ID) {
            if (oldState.selfMute !== newState.selfMute) {
                if (newState.selfMute) {
                    deleteTimeout(newState.member.id);
                    timeoutList.set(newState.member.id, setTimeout(async () => {
                        try {
                            await newState.member.voice.setChannel(AFK_CHANNEL_ID, 'User muted/deafened for 15 minutes');
                        } catch (error) {
                            logger.DBG(`Failed to move user ${newState.member.user.tag} to AFK channel: ${error.message}`);
                        }
                    }, 900000)); // 15 minutes
                } else {
                    deleteTimeout(oldState.member.id);
                }
            }
        }*/
    },

    /**
     * Resets the timeout for a member if they are in a voice channel and have a timeout set.
     * 
     * @param {Client} _client 
     * @param {GuildMember} member 
     */
    async resetTimeout(_client, member) {
        if (member.voice.channel && timeoutList.has(member.id)) {
            deleteTimeout(member.id);
            try {
                timeoutList.set(member.id, setTimeout(async () => {
                    try {
                        if (member.voice.channel) {
                            await member.voice.setChannel(AFK_CHANNEL_ID, 'User muted/deafened for 15 minutes');
                        }
                    } catch (error) {
                        logger.DBG(`Failed to move user ${member.user.tag} to AFK channel: ${error.message}`);
                    }
                }, 900000 /* 15 minutes */));
            } catch (error) {
                logger.DBG(`Failed to reset timeout for user ${member.id}: ${error.message}`);
            }
        }
    },

    /**
     * Scans all voice channels in the server except the AFK channel for muted or deafened members.
     * If a member is muted or deafened, they are given 15 minutes before being moved to the AFK channel.
     *
     * @param {Client} client - The Discord client instance.
     * @returns {Promise<void>}
     */
    async scanVoiceChannels(client) {
        const guild = client.guilds.cache.get('1119795689984102455');
        if (!guild) {
            logger.DBG('No guild found for the client.');
            return;
        }

        guild.channels.cache
            .filter(channel => channel.type === ChannelType.GuildVoice && channel.id !== AFK_CHANNEL_ID)
            .forEach(channel => {
                channel.members.forEach(member => {
                    if (member.voice.selfMute || member.voice.selfDeaf) {
                        deleteTimeout(member.id);
                        timeoutList.set(member.id, setTimeout(async () => {
                            try {
                                await member.voice.setChannel(AFK_CHANNEL_ID, 'User muted/deafened for 15 minutes');
                            } catch (error) {
                                logger.DBG(`Failed to move user ${member.user.tag} to AFK channel: ${error.message}`);
                            }
                        }, 900000)); // 15 minutes
                    }
                });
            });
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