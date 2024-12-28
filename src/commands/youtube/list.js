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

const { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../../logger');

/**
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 * @returns 
 */
async function execute(database, interaction) {
    try {
        const channels = await database.collection('youtube_channels').find().toArray();
        if (channels.length === 0) {
            await interaction.reply({ 
                content: 'No hay canales registrados.', 
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
        embed.setTitle('Canales de YouTube Registrados')
        embed.setColor(0x2b2d31)
        embed.setTimestamp();
        embed.setFooter({ text: `GD Venezuela` })
        embed.setAuthor({
            name: 'Venezuela',
            iconURL: 'https://flagcdn.com/w640/ve.png'
        })

        channels.forEach(channel => {
            embed.addFields({
                name: channel.username,
                value: `<https://youtube.com/channel/${channel.channelId}>`
            });
        });

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        logger.ERR(error);
        await interaction.reply({ 
            content: 'Ocurrió un error al ejecutar el comando.', 
            ephemeral: true 
        });
    }
}

module.exports = {
    execute
};