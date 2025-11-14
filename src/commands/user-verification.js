/**
 * Copyright (C) 2025 Zukaritasu
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

const { SlashCommandBuilder, ChatInputCommandInteraction, Client, Guild, Message, EmbedBuilder, User } = require("discord.js");
const { Db } = require("mongodb");
const logger = require('../logger');
const utils = require('../utils');
const channels = require('../../.botconfig/channels.json');
const { COLL_SERVER_NEW_ACCOUNTS } = require('../../.botconfig/database-info.json');
const { RESTJSONErrorCodes } = require('discord-api-types/v10')

/**
 * Checks if the user is inside the server
 * @param {Client} client
 * @param {ChatInputCommandInteraction | string} interaction
 * @returns {Promise<boolean>} True if the user is inside the server, false otherwise
 */
async function isUserInsideServer(client, interaction) {
    const guild = await client.guilds.fetch(utils.GD_VENEZUELA_SERVER_ID);
    let member;
    try {
        member = await guild.members.fetch(typeof interaction === 'string' ? interaction : interaction.user.id);
    } catch (err) {
        if (err.code === RESTJSONErrorCodes.UnknownMember) {
            return false;
        }
        throw err;
    }
    return member !== null;
}

/**
 * Tries to retrieve a User ID from a replied message (a reply).
 *
 * This function specifically looks for the user ID in a field named 'User ID' 
 * within the first embed of the message being replied to, but ONLY if 
 * that replied message was sent by the bot (identified by process.env.BOT_ID).
 *
 * If the message is not a reply, the replied message is not from the bot, 
 * or the necessary embed/field is not found, it returns null.
 *
 * @param {Message} message - The Message object which may contain a reference to another message.
 * @returns {Promise<string | null>} A promise that resolves with the User ID (string) if found, 
 * or null otherwise.
 */
async function getUserIDAux(message) {
    if (message.reference && message.reference?.messageId) {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId)
            .catch(err => logger.ERR("Error fetching replied message: " + err));
        if (repliedMessage && repliedMessage.author.id === process.env.BOT_ID) {
            if (repliedMessage.embeds.length > 0) {
                return repliedMessage.embeds[0].fields.find(field => field.name === 'User ID')?.value
            }
        }
    }

    return null
}

/**
 * Executes the user verification command.
 * This command allows users to request verification to join the server.
 * It checks if the user is already inside the server, and if not, sends a message
 * to the moderation channel notifying the staff of the verification request.
 * 
 * @param {Client} client 
 * @param {Db} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(client, _database, interaction) {
    try {
        await interaction.deferReply();
        // Check if the user is inside the server
        if (await isUserInsideServer(client, interaction)) {
            await interaction.editReply({
                content: 'Ya te encuentras dentro del servidor. No es necesario solicitar verificación.'
            });
            return;
        }

        // Check if the user is in the blacklist
        const blacklist = await _database.collection(COLL_SERVER_NEW_ACCOUNTS).findOne({ type: 'blacklist' });
        if (blacklist && Array.isArray(blacklist.accounts) && blacklist.accounts.includes(interaction.user.id)) {
            await interaction.editReply({
                content: '¡Acción denegada! / Action denied!'
            });
            return;
        }

        const channel = (await client.guilds.fetch(utils.GD_VENEZUELA_SERVER_ID))
            .channels.cache.get(channels.MODERATION);
        if (!channel) {
            throw new Error('Channel not found');
        }

        const embed = new EmbedBuilder()
        embed.setColor(0x2b2d31)
        embed.setTitle(interaction.user.tag)
        embed.setDescription(`El usuario ha solicitado ser verificado.`)
        embed.setThumbnail(interaction.user.displayAvatarURL({ size: 128, extension: 'png' }))
        embed.setFields(
            {
                name: 'User ID',
                value: interaction.user.id,
                inline: true
            },
            {
                name: 'Joined Discord',
                value: utils.formatDateTime(interaction.user.createdAt),
                inline: true
            }
        )

        await channel.send({ embeds: [embed] });
        await interaction.editReply({
            content: 'Tu solicitud de verificación ha sido enviada al staff. ¡Gracias!'
        });
    } catch (e) {
        logger.ERR(e);

        try {
            await interaction.editReply(
                {
                    content: 'Ocurrió un error al procesar tu solicitud. Intenta nuevamente más tarde.'
                }
            );
        } catch (err) {
            logger.ERR(err);
        }
    }
}

/**
 * Denies a user verification request.
 * This function bans the user from the server and sends them a notification.
 * If the user is already inside the server, it notifies that they are already a member
 * and does not proceed with the ban.
 * 
 * @param {Client} client 
 * @param {Db} database
 * @param {string[]} messageParts 
 * @param {Message} message 
 */
async function denyUser(client, database, message, messageParts) {
    try {
        // User ID to be denied
        const userId = messageParts[0] || await getUserIDAux(message);
        if (!userId) {
            await message.reply('El ID de usuario no se ha proporcionado, lo que impide continuar'); return;
        }

        if (await isUserInsideServer(client, userId)) {
            await message.reply('El usuario ya se encuentra dentro del servidor.'); return;
        }

        // Add userId to the blacklist in the database
        await database.collection(COLL_SERVER_NEW_ACCOUNTS).updateOne(
            { type: 'blacklist' },
            { $addToSet: { accounts: userId } },
            { upsert: true });

        // Try to fetch the user object
        const user = await client.users.fetch(userId);
        let dbClose = false;
        if (user) {
            try {
                await user.send(
                    'Tu cuenta ha sido baneada del servidor'
                );
                try {
                    await (await client.guilds.fetch('1405680731199508480')).members.kick(userId, 'Denied user');
                } catch (err) {
                    logger.ERR(`Error kicking user ${userId} from the alt server: ${err}`);
                }
            } catch (err) {
                if (err.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser) {
                    logger.ERR(err);
                    dbClose = true;
                } else {
                    throw err; // Rethrow other errors
                }
            }
        }
        // Ban the user from the guild
        await (await client.guilds.fetch(utils.GD_VENEZUELA_SERVER_ID)).bans.create(userId, {
            reason: 'Solicitud de verificación denegada'
        });
        await message.react('✅');
        if (dbClose) {
            await message.react('📧');
        }
    } catch (e) {
        logger.ERR(e);
        try {
            await message.reply(`Ocurrió un error al procesar la denegación. ${e.message}`);
        } catch (err) {
            logger.ERR(err);
        }
    }
}

/**
 * Welcomes a new member to the server with a custom image.
 * This function creates a welcome image using the member's avatar,
 * draws it on a canvas, and sends it to the welcome channel.
 * 
 * @param {Client} client 
 * @param {Db} database The database instance.
 * @param {Message} message 
 * @param {string[]} messageParts
 */
async function approveUser(client, database, message, messageParts) {
    try {
        const userId = messageParts[0] || await getUserIDAux(message);
        if (!userId) {
            await message.reply('El ID de usuario no se ha proporcionado, lo que impide continuar'); return;
        }

        if (await isUserInsideServer(client, userId)) {
            await message.reply('El usuario ya se encuentra dentro del servidor.'); return;
        }

        // Add userId to the whitelist in the database
        await database.collection(COLL_SERVER_NEW_ACCOUNTS).updateOne(
            { type: 'whitelist' },
            { $addToSet: { accounts: userId } },
            { upsert: true });

        // Notify the user
        const user = await client.users.fetch(userId);
        let dbClose = false;
        if (user) {
            try {
                await user.send(
                    '¡Has sido aprobado para entrar al servidor!\n\nhttps://discord.gg/gdvenezuela'
                );
                try {
                    await (await client.guilds.fetch('1405680731199508480')).members.kick(userId, 'Approved user');
                } catch (err) {
                    logger.ERR(`Error kicking user ${userId} from the alt server: ${err}`);
                }
            } catch (err) {
                if (err.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser) {
                    logger.ERR(err);
                    dbClose = true;
                } else {
                    throw err; // Rethrow other errors
                }
            }
        }

        await message.react('✅');
        if (dbClose) {
            await message.react('📧');
        }
    } catch (e) {
        logger.ERR(e);
        try {
            await message.reply(`Ocurrió un error al procesar la aprobación. ${e.message}`);
        } catch (err) {
            logger.ERR(err);
        }
    }
}

/**
 * Send a direct message to the user. The user may have DMs turned
 * off, soit will be impossible to send them a message unless a
 * staff member sends them one.
 * @param {Client} client -bot instance
 * @param {Message} message - Original message invoking the command
 * @param {string} content - Message content, including the command
 * @returns {Promise<void>}
 */
async function sendDM(client, message, content) {
    try {
        if (!message.reference || !message.reference.messageId)
            return null;

        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (!repliedMessage || repliedMessage.author.id !== '1294111960882872341')
            return null;

        let userId = null
        for (let i = 0; i < repliedMessage.embeds.length; i++) {
            const field = repliedMessage.embeds[i].fields.find(field => field.name === 'User ID')
            if (field) {
                userId = field.value
                break;
            }
        }

        const match = content.match(/^--dm\s+(.+)$/);
        if (!match)
            return await message.reply('Formato inválido. Usa: --dm <mensaje>');
        const [, dmContent] = match;
        let user
        try {
            user = await client.users.fetch(userId)
        } catch (error) {
            logger.ERR(error)
            return await message.reply(`Error al buscar el usuario`)
        }

        await user.send(`**[STAFF]** ${dmContent}\n\n-# Para responder ejecuta el comando /responder`)
        await message.react('✅')
    } catch (error) {
        try {
            if (error?.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser)
                return await message.react('📧')
            logger.ERR(error)
            await message.reply(`Ha ocurrido un error inesperado: ${error?.message || 'Unknown'}`)
        } catch {

        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Notifica al Staff para verificar un usuario'),
    execute,
    sendDM,
    denyUser,
    approveUser
};