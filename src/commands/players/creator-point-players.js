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
const { Db } = require('mongodb');
const axios = require('axios');

const EMBED_COLOR = 0x2b2d31 /** Black */

/**
 * 
 * @param {number} accountID 
 */
async function getGJUserInfo20(accountID) {
    const data = new URLSearchParams({
        "secret": "Wmfd2893gb7",
        "targetAccountID": accountID
    });

    return axios.post('http://www.boomlings.com/database/getGJUserInfo20.php', data, {
        headers: {
            'User-Agent': '',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
}

/**
 * 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function getUserCreatorPointsList(database, interaction) {
    let fields = []
    try {
        const cpPlayers = database.collection('cpPlayers')

        for await (const doc of cpPlayers.find()) {
            const member = interaction.guild.members.cache.find(member => member.id === doc.userID)
            if (member === undefined)
                continue

            const response = (await getGJUserInfo20(doc.accountID)).data
            if (`${response}` === '-1') {
                continue
            }

            const map = new Map();
            const pairs = response.split(':');
            for (let i = 0; i < pairs.length; i += 2) 
                map.set(pairs[i], pairs[i + 1]);

            fields.push(
                {
                    cpCount: parseInt(map.get('8')),
                    name: `${map.get('1')}`,//member.user.globalName ? member.user.globalName : member.user.username,
                    value: `${map.get('8')}`,
                    inline: true
                })
        }
    } catch (e) {
        console.error(e)
        return { content: 'An error occurred while querying the database information' }
    }

    if (fields.length === 0) {
        return { content: 'No se encontró información sobre los jugadores que tienen puntos de creador' }
    }

    fields.sort((a, b) => b.cpCount - a.cpCount);

    const embed = new EmbedBuilder()
    embed.setColor(0x2b2d31)
    embed.setTitle(`Jugadores con Puntos de Creador`)
    embed.setFooter({ text: `GD Venezuela` })
    embed.setThumbnail('https://cdn.discordapp.com/attachments/1041217295743197225/1296321837847805973/cp_venezuela.png')
    embed.setTimestamp()
    embed.addFields(fields)

    embed.setAuthor({
        name: 'Venezuela',
        iconURL: 'https://flagcdn.com/w640/ve.png'
    })

    return { embeds: [embed] }
}

/**
 * 
 * @param {Client} _client 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, database, interaction) {
    try {
        await interaction.deferReply();
        await interaction.editReply(await getUserCreatorPointsList(database, interaction));
    } catch (error) {
        console.error(error)
        await interaction.editReply('An unknown error has occurred. Please try again later');
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jugadores_cp')
        .setDescription('Lista de Jugadores con puntos de creador'),
    execute,
};