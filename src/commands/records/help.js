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

const { SlashCommandBuilder, ChatInputCommandInteraction, Message } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../../logger');
const { EmbedBuilder } = require('discord.js');

/**
 * @param {CLient} _client 
 * @param {Db} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, _database, interaction) {
    try {
        await interaction.deferReply();
        if (interaction.member.user.id !== '591640548490870805') {
            await interaction.editReply('El comando no se encuentra disponible en este momento. Por favor, intenta más tarde.');
        } else {
            const embed = new EmbedBuilder()
                .setTitle('REQUISITOS PARA ENVIAR UN RECORD')
                .setDescription(
                    'Los requisitos para poder enviar un record son los siguientes:\n\n' +
                    '- Ser venezolano\n' +
                    '- El video debe tener clicks audibles\n' +
                    '- Si el nivel está dentro del **Top 150** previamente debe ser aceptado en la **Demonlist**\n\n' +
                    'El video debe ser enviado al canal <#1368411272965525684> con el siguiente formato:\n\n' +
                    '```\nNombre del nivel\n' +
                    'name: <tu nombre>\n' +
                    'video: <link del video>```'
                )
                .setImage('https://media.discordapp.net/attachments/1294668385950498846/1374038150992756879/image.png')
                .setColor(0x2b2d31);

            await interaction.editReply({ embeds: [embed] });
        }
    } catch (e) {
        logger.ERR(`Error al ejecutar el comando help: ${e}`);
        try {
            await interaction.editReply('An unknown error has occurred');
        } catch {

        }
    }
}

module.exports = {
    execute
}