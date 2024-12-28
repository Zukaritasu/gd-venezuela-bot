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
const utils = require('../../utils');

/**
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 * @returns 
 */
async function execute(database, interaction) {
    try {
        if (!utils.hasUserPermissions(interaction.member)) {
            await interaction.reply({ 
                content: 'No tienes permisos para ejecutar este comando.', 
                ephemeral: true 
            });
            return;
        }

        const channel = await database.collection('youtube_channels').findOne({ 
            username: interaction.options.getString('username'),
            channelId: interaction.options.getString('channel_id')

        });
        if (!channel) {
            await interaction.reply({ 
                content: 'Ups... Canal no encontrado.', 
                ephemeral: true 
            });
            return;
        }

        const result = await database.collection('youtube_channels').deleteOne({ _id: channel._id });
        if (result.deletedCount === 0) {
            await interaction.reply({ 
                content: 'No se pudo eliminar el canal.', 
                ephemeral: true 
            });
            return;
        }

        await interaction.reply({ 
            content: 'Canal eliminado con exito!', 
            ephemeral: true 
        });
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