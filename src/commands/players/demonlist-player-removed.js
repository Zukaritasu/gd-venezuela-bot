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
const utils = require('../../utils');
const apipcrate = require('../../apipcrate');
const { Db } = require('mongodb');

const EMBED_COLOR = 0x2b2d31 /** Black */

/**
 * 
 * @param {number} id 
 * @returns Object
 */
async function getPlayerInfo(id) {
    /** @type Object */
    const response = await apipcrate.getPlayerInfo(id);
    if (response instanceof Error || response instanceof SyntaxError)
        throw response
    return apipcrate.utils.getNumberDemonsByCategory(response.data.records)
}

/**
 * 
 * @returns
 */
async function getVenezuelaLeaderboard() {
    /** @type Object[] */
    const response = await apipcrate.getCountryLeaderboard('VE');
    if (response instanceof Error)
        throw response

    let players = [] // fields
    for (let i = 0; i < response.length; i++) {
        if (response[i].score === 0 || response[i].banned) {
            players.push({
                score: response[i].score,
                    name: utils.escapeDiscordSpecialChars(response[i].name),
                value: `${response[i].score > 0 ? `${response[i].score.toFixed(2)} puntos\n` : ''} ${await getPlayerInfo(response[i].id)}`
                    .concat(`${response[i].banned ? '\n***banned***' : ''}`), // to string
                inline: true
            })
        }
    }

    players.sort((a, b) => b.score - a.score);

    return players;
}

/**
 * 
 * @returns 
 */
async function createEmbedLeaderboard() {
    const players = await getVenezuelaLeaderboard()
    if (players.length === 0) {
        return { content: 'Ha ocurrido un error desconocido' }
    }

    const embed = new EmbedBuilder()
    embed.setColor(0x2b2d31)
    embed.setTitle(`Jugadores Retirados de la Demonlist`)
    embed.setFooter({ text: `GD Venezuela` })
    embed.setThumbnail('https://cdn.discordapp.com/icons/395654171422097420/379cfde8752cedae26b7ea171188953c.png')
    embed.setTimestamp()
    embed.addFields(players)

    embed.setAuthor({
        name: 'Venezuela',
        iconURL: 'https://flagcdn.com/w640/ve.png'
    })

    return { embeds: [embed] }
}

/**
 * 
 * @param {Client} _client 
 * @param {Db} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, _database, interaction) {
    try {
        await interaction.deferReply();
        await interaction.editReply(await createEmbedLeaderboard());
    } catch (error) {
        console.error(error)
        await interaction.editReply('An unknown error has occurred. Please try again later');
    }
}

module.exports = {
    execute
};