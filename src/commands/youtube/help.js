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

const { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Client } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../../logger');

/**
 * @param {Client} _client 
 * @param {Db} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, _database, interaction) {
    try {
        const embed = new EmbedBuilder()
        embed.setTitle('Comandos de YouTube')
        embed.setDescription('Comandos relacionados con YouTube')
        embed.setColor(0x2b2d31)
        embed.setTimestamp()
        embed.setFooter({ text: `GD Venezuela` })
        embed.addFields(
            {
                name: '/youtube notification (solo personal autorizado)',
                value: 'Con este comando puedes agregar o editar un canal de YouTube para recibir notificaciones de nuevos vídeos. Si el bot se queda desconectado (se fue la luz), cuando se restablezca la conexión notificará de los nuevos vídeos publicados en las últimas 24 horas. Solo el personal autorizado puede utilizar este comando.\n\nParametros:\n- `role`: Rol al que se notificará\n- `username`: Nombre de usuario\n- `description`: El mensaje de la notificación\n- `channel`: Canal de YouTube\n- `user`: Dueño del canal de YouTube (opcional)',
            },
            {
                name: '/youtube help',
                value: 'Muestra este mensaje de ayuda.'
            },
            {
                name: '/youtube list',
                value: 'Muestra la lista de canales de YouTube registrados.'
            },
            {
                name: '/youtube remove (solo personal autorizado)',
                value: 'Elimina un canal de YouTube de la lista de notificaciones. Solo el personal autorizado puede usar este comando.\n\nParametros:\n- `username`: Nombre de usuario\n- `channel`: Canal de YouTube'
            }
        );

        embed.setAuthor({
            name: 'Venezuela',
            iconURL: 'https://flagcdn.com/w640/ve.png'
        })

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        logger.ERR('aaaaa', error);
        try {
            await interaction.reply('Ha ocurrido un error al ejecutar el comando');
        } catch (err) {
            logger.ERR(err);
        }
    }
}

module.exports = {
    execute
}