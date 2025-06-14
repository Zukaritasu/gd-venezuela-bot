const { Events, Client, ChatInputCommandInteraction, Message, GuildMember, AttachmentBuilder } = require('discord.js');
const submit = require('../commands/records/submit');
const logger = require('../logger');

module.exports = {
    name: Events.MessageUpdate,
    once: false,
    /**
     * @param {Client} client 
     * @param {Db} database 
     * @param {Message} oldMessage 
     * @param {Message} newMessage 
     */
    async execute(client, database, oldMessage, newMessage) {
        try {
            if (newMessage.content == oldMessage.content) 
                return;
            if (newMessage.channelId == '1369415419093586070') {
                const command = newMessage.content.split('\n');
                if (command.length >= 3) {
                    await submit.processSubmitRecord(database, newMessage, command);
                } else {
                    const existingReaction = newMessage.reactions.cache.get('❌');
                    if (!existingReaction || !existingReaction.me) {
                        await newMessage.react('❌');
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
};