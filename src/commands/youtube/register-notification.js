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
const utils = require('../../utils');
const YOUTUBE_API_KEY = require('../../../.botconfig/token.json').YOUTUBE_API_KEY;

/**
 * @param {ChatInputCommandInteraction} interaction 
 */
async function getNotificationInfo(interaction) {
    const mentionRole = interaction.options.getRole('role');
    const user = interaction.options.getUser('user');
    const username = interaction.options.getString('username');
    const description = interaction.options.getString('description');
    const channel = interaction.options.getString('channel');

    if (!mentionRole || !username || !description || !channel) {
        await interaction.reply({ content: 'Todos los campos son obligatorios.', ephemeral: true });
        return;
    }

    const channelIdMatch = channel.match(/UC[\w-]{21}[AQgw]/);
    if (!channelIdMatch) {
        await interaction.reply({ 
            content: 'Canal inválido.', 
            ephemeral: true 
        });
        return;
    }
    const channelId = channelIdMatch[0];

    const url = `https://www.googleapis.com/youtube/v3/channels?part=id&id=${channelId}&key=${YOUTUBE_API_KEY}`;
    try {
        const response = await fetch(url);
        const json = await response.json();

        if (!response.ok || !json.items || json.items.length === 0) {
            await interaction.reply({ 
                content: 'Canal no encontrado.', 
                ephemeral: true 
            });
            return;
        }

        return { mentionRoleId: mentionRole.id, userId: user ? user.id : null, username, 
            description, channel, channelId, publishedAt: '' };
    } catch (error) {
        logger.ERR(error.message);
        await interaction.reply({ content: 
            'Error al obtener información del canal.', 
            ephemeral: true 
        });
    }
}

/**
 * @param {Db} db 
 * @param {Client} _client 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(db, _client, interaction) {
    try {
        if (!interaction.member)
            return;
        if (utils.hasUserPermissions(interaction.member)) {
            await interaction.reply({ 
                content: 'No tienes permisos para ejecutar este comando.', 
                ephemeral: true 
            });
            return;
        }

        const notificationInfo = await getNotificationInfo(interaction)
        if (!notificationInfo) 
            return

        const { userId, channelId } = notificationInfo
        const notify = await db.collection('youtube_channels').findOne({ 
            userId: userId, channelId: channelId
        });

        let result;
        if (!notify) {
            result = await db.collection('youtube_channels').insertOne(notificationInfo);
        } else {
            result = await db.collection('youtube_channels').updateOne(
                { _id: notify._id },
                { $set: notificationInfo }
            );
        }

        await interaction.reply({ 
            content: result.acknowledged ? 'Notificación registrada correctamente!' : 
                'Ocurrió un error al registrar la notificación', 
            ephemeral: true 
        });
    } catch (error) {
        logger.ERR('Error en la ejecución del comando:', error);
        await interaction.reply({ 
            content: 'Ocurrió un error al registrar la notificación.', 
            ephemeral: true 
        });
    }
}

module.exports = {
    execute
}