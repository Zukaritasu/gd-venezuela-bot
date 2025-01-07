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
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    Client } = require('discord.js');
const utils = require('../../utils');
const logger = require('../../logger');
const apipcrate = require('../../apipcrate');
const playerProfile = require('./demonlist/profile')
const { Db } = require('mongodb');


async function getVenezuelaPointsLeaderboard() {
    /** @type Object[] */
    const response = await apipcrate.getCountryLeaderboard('VE');
    if (response instanceof Error)
        throw response

    if (response.length === 0)
        return '*No se encontraron usuarios en la tabla de puntuaciones del país.*'

    response.sort((a, b) => b.score - a.score);

    let desc = [] // description
    for (let i = 0; i < response.length; i++) {
        if (response[i].score > 0) {
            desc += `${i + 1}. **${utils.escapeDiscordSpecialChars(response[i].name)}** *${response[i].score.toFixed(2)}*\n`
        }
    }
    return desc;
}

async function createEmbed() {
    const embed = new EmbedBuilder()
    embed.setColor(0x2b2d31)
    embed.setTitle('PUNTUACIONES DE LOS JUGADORES')
    embed.setFooter({ text: `GD Venezuela` })
    embed.setThumbnail('https://cdn.discordapp.com/icons/395654171422097420/379cfde8752cedae26b7ea171188953c.png')
    embed.setTimestamp()
    embed.setDescription(await getVenezuelaPointsLeaderboard())

    embed.setAuthor({
        name: 'Venezuela',
        iconURL: 'https://flagcdn.com/w640/ve.png'
    })

    return {
        embeds: [embed]
    }
}

/**
 * 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(interaction) {
    try {
        await interaction.deferReply();
        await interaction.editReply(await createEmbed())
    } catch (e) {
        logger.ERR(e)
        try {
            await interaction.editReply('An unknown error has occurred. Please try again later');
        } catch (error) {
            logger.ERR(`Error sending reply: ${error.message}`)
        }
    }
}

module.exports = {
    execute
};