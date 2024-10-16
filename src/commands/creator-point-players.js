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

const { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder,
    ButtonBuilder, ButtonStyle,
    Client } = require('discord.js');
const https = require('https');
const utils = require('../utils');
const { Db } = require('mongodb');

const EMBED_COLOR = 0x2b2d31 /** Black */


/**
 * 
 * @param {Client} _client 
 * @param {Db} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, _database, interaction) {
    try {
        await interaction.deferReply();
        if (interaction.member.id !== '591640548490870805') {
            await interaction.editReply('Esta opción no está disponible. Intente más tarde');
        } else {
            await interaction.editReply('hola');
        }
    } catch (error) {
        console.error(error)
        await interaction.editReply('An unknown error has occurred. Please try again later');
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('creator-point-players')
        .setDescription('Lista de Jugadores de la Demonlist'),
    execute,
};