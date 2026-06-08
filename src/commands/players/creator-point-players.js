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

const { EmbedBuilder, ChatInputCommandInteraction, Client, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Db } = require('mongodb');
const robtopapi = require('../../robtopapi');
const { COLL_CREATOR_POINT_PLAYERS } = require('../../../.botconfig/database-info.json');
const logger = require('../../logger');

const ERROR_TIMEOUT_MESSAGE = 'Collector received no interactions before ending with reason: time'
const ITEMS_PER_PAGE = 24

///////////////////////////////////////////

/**
 * 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function getCreatorPointsUsersList(database, interaction) {
    let fields = []
    try {
        const cpPlayers = database.collection(COLL_CREATOR_POINT_PLAYERS)

        for await (const doc of cpPlayers.find()) {
            const member = interaction.guild.members.cache.find(member => member.user.id === doc.userID)
            if (!member) {
                logger.DBG(`User with ID ${doc.userID} not found in the server. Skipping...`)
                continue
            }
            
            const response = await robtopapi.getGJUserInfo20(doc.accountID)
            if (!response) {
                logger.DBG(`Failed to fetch user info for account ID ${doc.accountID}. Skipping...`)
                continue
            }

            fields.push(
                {
                    cpCount: parseInt(response.get('creatorpoints')),
                    name: `${response.get('userName')}`,
                    value: `${response.get('creatorpoints')}`,
                    inline: true
                })
        }
    } catch (e) {
        logger.ERR(e)
        return { content: 'An error occurred while querying the database information' }
    }

    if (fields.length === 0) {
        return { content: 'No se encontró información sobre los jugadores que tienen puntos de creador' }
    }

    fields.sort((a, b) => b.cpCount - a.cpCount);

    const baseEmbedProps = {
        color: 0x2b2d31,
        title: 'JUGADORES CON PUNTOS DE CREADOR',
        footer: { text: 'GD Venezuela' },
        thumbnail: 'https://cdn.discordapp.com/attachments/1041217295743197225/1296321837847805973/cp_venezuela.png',
        author: {
            name: 'Venezuela',
            iconURL: 'https://flagcdn.com/w640/ve.png'
        }
    }

    const pageCount = Math.max(1, Math.ceil(fields.length / ITEMS_PER_PAGE))
    let currentPage = 0

    function buildEmbedForPage(page) {
        const start = page * ITEMS_PER_PAGE
        const end = Math.min(start + ITEMS_PER_PAGE, fields.length)
        const embed = new EmbedBuilder()
            .setColor(baseEmbedProps.color)
            .setTitle(baseEmbedProps.title)
            .setFooter(baseEmbedProps.footer)
            .setThumbnail(baseEmbedProps.thumbnail)
            .setTimestamp()
            .setAuthor(baseEmbedProps.author)
            .addFields(fields.slice(start, end))
        return embed
    }

    function buildComponents(page) {
        const buttons = []

        if (pageCount > 1) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setEmoji('<:retroceder:1436857028092887091>')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setEmoji('<:siguiente:1436857026876538900>')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === pageCount - 1)
            )
        }

        buttons.push(
            new ButtonBuilder()
                .setCustomId('close')
                .setEmoji('<:closeicon:1219429070266437693>')
                .setStyle(ButtonStyle.Danger)
        )

        return [new ActionRowBuilder().addComponents(buttons)]
    }

    const message = {
        content: '',
        embeds: [buildEmbedForPage(currentPage)],
        components: buildComponents(currentPage)
    }

    if (pageCount === 1) {
        return message
    }

    try {
        const response = await interaction.editReply(message)
        while (true) {
            const confirmation = await response.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 300000
            })

            await confirmation.deferUpdate()

            if (confirmation.customId === 'close') {
                await interaction.deleteReply()
                break
            }

            if (confirmation.customId === 'prev' && currentPage > 0) {
                currentPage--
            } else if (confirmation.customId === 'next' && currentPage < pageCount - 1) {
                currentPage++
            }

            message.embeds = [buildEmbedForPage(currentPage)]
            message.components = buildComponents(currentPage)
            await interaction.editReply(message)
        }
    } catch (e) {
        if (e.message === ERROR_TIMEOUT_MESSAGE) {
            message.components.forEach(row => row.components.forEach(button => button.setDisabled(true)))
            await interaction.editReply(message)
        } else {
            logger.ERR('Error in getCreatorPointsUsersList:', e)
            await interaction.editReply({ embeds: [], content: 'An unknown error has occurred', components: [] })
        }
    }

    return null
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
        const response = await getCreatorPointsUsersList(database, interaction)
        if (response) {
            await interaction.editReply(response)
        }
    } catch (error) {
        logger.ERR(error)
        await interaction.editReply('An unknown error has occurred. Please try again later');
    }
}

module.exports = {
    execute
};