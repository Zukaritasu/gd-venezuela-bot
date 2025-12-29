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

const { EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    Client } = require('discord.js');
const utils = require('../../utils');
const apipcrate = require('../../apipcrate');
const logger = require('../../logger');
const { Db } = require('mongodb');
const playerProfile = require('./demonlist/profile')

//////////////////////////////////////

const ERROR_TIMEOUT_MESSAGE = 'Collector received no interactions before ending with reason: time'

/**
 * 
 * @param {number} id 
 * @returns Object
 */
async function getPlayerInfo(id) {
    /** @type Object */
    const response = await apipcrate.getPlayerInfo(id);
    if (response instanceof Error)
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
        // Players with 0 points are discarded as they are not visible on the list
        if (response[i].score > 0) {
            players.push({
                score: response[i].score,
                originalName: response[i].name,
                    name: utils.escapeDiscordSpecialChars(response[i].name),
                    value: `${response[i].score.toFixed(2)} puntos\n${await getPlayerInfo(response[i].id)}`, // to string,
                playerId: response[i].id,
                inline: true
            })
        }
    }

    players.sort((a, b) => b.score - a.score);

    return players;
}

/**
 * 
 * @param {*} database 
 * @param {ChatInputCommandInteraction} interaction 
 * @returns 
 */
async function createEmbedLeaderboard(database, interaction) {
    const players = await getVenezuelaLeaderboard()
    if (players.length === 0) {
        await interaction.editReply({ content: 'No se encontraron jugadores de este pais' })
        return 
    }
    const ITEMS_PER_PAGE = 12

    const baseEmbedProps = {
        color: 0x2b2d31,
        title: 'Jugadores de la Demonlist',
        footer: { text: 'GD Venezuela' },
        thumbnail: 'https://cdn.discordapp.com/icons/395654171422097420/379cfde8752cedae26b7ea171188953c.png',
        author: { name: 'Venezuela', iconURL: 'https://flagcdn.com/w640/ve.png' }
    }

    const pageCount = Math.max(1, Math.ceil(players.length / ITEMS_PER_PAGE))
    let currentPage = 0

    function buildEmbedForPage(page) {
        const start = page * ITEMS_PER_PAGE
        const end = Math.min(start + ITEMS_PER_PAGE, players.length)
        const embed = new EmbedBuilder()
        embed.setColor(baseEmbedProps.color)
        embed.setTitle(baseEmbedProps.title)
        embed.setFooter(baseEmbedProps.footer)
        embed.setThumbnail(baseEmbedProps.thumbnail)
        embed.setTimestamp()
        embed.setAuthor(baseEmbedProps.author)
        embed.addFields(players.slice(start, end))
        return embed
    }

    function buildSelectForPage(page) {
        const start = page * ITEMS_PER_PAGE
        const end = Math.min(start + ITEMS_PER_PAGE, players.length)
        const options = []
        for (let i = start; i < end; i++) {
            options.push(
                new StringSelectMenuOptionBuilder()
                    .setValue(String(i))
                    .setLabel(players[i].originalName)
            )
        }
        return new StringSelectMenuBuilder()
            .setCustomId('player')
            .setPlaceholder('Selecciona un jugador')
            .addOptions(options)
    }

    function buildComponents(page) {
        const components = []

        components.push(new ActionRowBuilder().addComponents(buildSelectForPage(page)))

        const buttons = []
        if (pageCount > 1) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setEmoji('<:retroceder:1436857028092887091>')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0)
            )
            buttons.push(
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

        components.push(new ActionRowBuilder().addComponents(buttons))
        return components
    }

    let message = {
        content: '',
        embeds: [buildEmbedForPage(currentPage)],
        components: buildComponents(currentPage)
    }

    try {
        const response = await interaction.editReply(message);
        let confirmation = null;

        const collectorFilter = i => i.user.id === interaction.user.id;
        
        while (true) {
            if (confirmation !== null) {
                await confirmation.editReply(message)
            }

            confirmation = await response.awaitMessageComponent(
                {
                    filter: collectorFilter,
                    time: 300000 // 5 min
                }
            );

            await confirmation.deferUpdate();

            if (confirmation.customId === 'close') {
                await interaction.deleteReply(response); break;
            } else if (confirmation.customId === 'prev') {
                if (currentPage > 0) currentPage--
                message = {
                    content: '',
                    embeds: [buildEmbedForPage(currentPage)],
                    components: buildComponents(currentPage)
                }
                continue
            } else if (confirmation.customId === 'next') {
                if (currentPage < pageCount - 1) currentPage++
                message = {
                    content: '',
                    embeds: [buildEmbedForPage(currentPage)],
                    components: buildComponents(currentPage)
                }
                continue
            } else if (confirmation.customId === 'player') {
                let embedProfileMessage = null
                try {
                    const embedProfile = await playerProfile.createEmbedProfile(undefined, database, interaction,
                        players[parseInt(confirmation.values[0])].playerId)

                    if (!embedProfile) {
                        await interaction.editReply(
                            {
                                embeds: [],
                                content: 'An unknown error has occurred. Please try again later.',
                                components: []
                            }
                        )
                        break
                    }

                    await confirmation.editReply(embedProfileMessage = {
                        content: '',
                        embeds: [embedProfile],
                        components: [
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('back')
                                        .setEmoji('<:retroceder:1436857028092887091>')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId('close')
                                        .setEmoji('<:closeicon:1219429070266437693>')
                                    .setStyle(ButtonStyle.Danger)
                            )
                        ]
                    })

                    confirmation = await response.awaitMessageComponent(
                        {
                            filter: collectorFilter,
                            time: 300000 // 5 min
                        }
                    );

                    await confirmation.deferUpdate();

                    if (confirmation.customId === 'close') {
                        await interaction.deleteReply(response); break;
                    }
                } catch (e) {
                    if (e.message !== ERROR_TIMEOUT_MESSAGE) {
                        console.error(e)
                        await interaction.editReply(
                            {
                                embeds: [],
                                content: 'An unknown error has occurred',
                                components: []
                            }
                        );
                    } else if (embedProfileMessage) {
                        embedProfileMessage.components.forEach(rows => {
                            rows.components.forEach(component => {
                                component.setDisabled(true)
                            })
                        })
                        await interaction.editReply(embedProfileMessage);
                    }
                    break
                }
            }
        }
    } catch (e) {
        try { // try catch to ensure if a new exception occurs from calling the editReply method
            if (e.message !== ERROR_TIMEOUT_MESSAGE) {
                logger.ERR('Error in createEmbedLeaderboard:', e);
                await interaction.editReply(
                    {
                        embeds: [],
                        content: 'An unknown error has occurred',
                        components: []
                    }
                );
            } else {
                message.components.forEach(rows => {
                    rows.components.forEach(component => {
                        component.setDisabled(true)
                    })
                })
                await interaction.editReply(
                    {
                        embeds: [embed],
                        components: message.components
                    }
                );
            }
        } catch (err) {
            logger.ERR('Error handling exception in createEmbedLeaderboard:', err);
        }
    }
}

/**
 * 
 * @param {Client} _client 
 * @param {Db} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, database, interaction) {
    try {
        await interaction.deferReply();
        await createEmbedLeaderboard(database, interaction)
    } catch (error) {
        logger.ERR('Error in demonlist-players command:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('An unknown error has occurred');
        } else {
            await interaction.reply('An unknown error has occurred');
        }
    }
}

module.exports = {
    execute
};