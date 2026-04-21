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


const { Client, Message } = require('discord.js');
const utils = require('../../utils');
const logger = require('../../logger');

/**
 * Clones a message to a specified channel.
 * @param {Client} client - The Discord client instance.
 * @param {Message} message - The message that triggered the command.
 * @param {string[]} parameters - An array of parameters where the first element is
 * the target channel ID and the rest are message IDs to clone.
 */
async function clone(client, message, parameters) {
    if (parameters.length >= 2) {
        try {
            const channelId = parameters[0];
            const channel = await client.channels.fetch(channelId);
            if (!channel) {
                await message.reply('No se pudo encontrar el canal especificado.');
                return;
            }

            for (let i = 1; i < parameters.length; i++) {
                const messageId = parameters[i];
                const messageToClone = await message.channel.messages.fetch(messageId)
                if (messageToClone) {
                    await channel.send({
                        content: messageToClone.content,
                        /*embeds: messageToClone.embeds,
                        files: messageToClone.attachments.map(attachment => attachment.url)*/
                    })
                } else {
                    await message.reply(`No se pudo encontrar el mensaje ${messageId} a clonar.`)
                }
            }

            await message.react('✅')
        } catch (error) {
            logger.ERR('Error al clonar el mensaje:', error)
            await message.reply('Ocurrió un error al intentar clonar los mensajes. Asegúrate de que el ID del canal y el ID de o los mensaje sean correctos ' +
                'y que el bot tenga acceso al canal donde se encuentra el mensaje.')
        }
    } else {
        await message.reply('Por favor, proporciona el ID del canal y el ID del mensaje que deseas clonar. ' +
            'Uso: `--clone-message <channelId> <messageId...>`')
    }
}

module.exports = {
    clone
}