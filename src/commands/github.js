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

const { SlashCommandBuilder, ChatInputCommandInteraction, Client } = require("discord.js");
const { Db } = require("mongodb");
const logger = require("../logger");

/**
 * 
 * @param {Client} _client 
 * @param {Db} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, _database, interaction) {
    try {
        await interaction.reply('https://github.com/Zukaritasu/gd-venezuela-bot')
    } catch (e) {
        logger.ERR(`Error executing /github command: ${e.message}`, e);
        try {
            await interaction.channel?.send(`<@${interaction.member.id}> An unknown error has occurred [GitHub Link]`)
        } catch (error) {
            logger.ERR(`Error sending message in /github command: ${error.message}`, error);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('github')
        .setDescription('Repositorio de GitHub donde está ubicado el bot GDVenezuelaBot'),
    execute,
};