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
const logger = require('../../logger');
const apipcrate = require('../../apipcrate');
const playerProfile = require('./demonlist/profile')
const { RESTJSONErrorCodes } = require('discord-api-types/v10')
const { Db } = require('mongodb');

////////////////////////////////////

const ERROR_TIMEOUT_MESSAGE = 'Collector received no interactions before ending with reason: time'

const EMOJI_PREV = '<:retroceder:1436857028092887091>';
const EMOJI_NEXT = '<:siguiente:1436857026876538900>';
const EMOJI_CLOSE = '<:closeicon:1219429070266437693>';
const MAX_FIELDS_PER_EMBED = 25;

/**
 * @param {number} id 
 * @returns {Promise<string>}
 */
async function getPlayerInfo(id) {
    /** @type Object */
    const response = await apipcrate.getPlayerInfo(id);
    if (response instanceof Error || response instanceof SyntaxError)
        throw response
    //return `${response.data.records.filter(record => record.progress === 100 && record.demon.position > 150).length} Legacy`
    return apipcrate.utils.getNumberDemonsByCategory(response.data.records)
}

/**
 * @returns
 */
async function getVenezuelaLeaderboard() {
    const response = await apipcrate.getCountryLeaderboard('VE');
    if (response instanceof Error)
        throw response

    let players = [] // fields
    const playersPromises = response.map(async (p) => {
        if (p.score === 0 || p.banned) {
            const playerInfo = await getPlayerInfo(p.id);
            return {
                score: p.score,
                originalName: p.name,
                name: utils.escapeDiscordSpecialChars(p.name),
                value: `${p.score > 0 ? `${p.score.toFixed(2)} puntos\n` : ''} ${playerInfo}`
                    .concat(`${p.banned ? '\n***banned***' : ''}`), // to string
                playerId: p.id,
                inline: true
            };
        }
        return null;
    });

    players = (await Promise.all(playersPromises)).filter(p => p !== null);
    players.sort((a, b) => b.score - a.score);

    return players;
}

/**
 * Paginates the full list of leaderboard players into separate arrays.
 * This is necessary because Discord embeds are limited to a maximum of 25 fields.
 * 
 * @param {Array<Object>} players - The full array of player objects, pre-formatted as embed fields.
 * @returns {Array<Array<Object>>} An array of arrays, where each inner array represents one page 
 * (a collection of up to 25 player field objects).
 */
function getLeaderboardPages(players) {
    const pages = [];
    for (let i = 0; i < players.length; i += MAX_FIELDS_PER_EMBED) {
        pages.push(players.slice(i, i + MAX_FIELDS_PER_EMBED));
    }
    return pages;
}

/**
 * Creates the message object (embed and components) for a specific page.
 * 
 * @param {Array<Object>} pagePlayers - Players for the current page.
 * @param {number} currentPage - Current page index (0-based).
 * @param {number} totalPages - Total number of pages.
 * @param {Array<Object>} allPlayers - Complete list of players for the Select Menu.
 * @returns {Object} The message object for the Discord response.
 */
function createEmbedPage(pagePlayers, currentPage, totalPages, allPlayers) {
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(`Jugadores retirados de la Demonlist (Página ${currentPage + 1}/${totalPages})`)
        .setFooter({ text: `GD Venezuela | Total de jugadores: ${allPlayers.length}` })
        .setThumbnail('https://cdn.discordapp.com/icons/395654171422097420/379cfde8752cedae26b7ea171188953c.png')
        .setTimestamp()
        .setAuthor({
            name: 'Venezuela',
            iconURL: 'https://flagcdn.com/w640/ve.png'
        });

    const startPosition = currentPage * MAX_FIELDS_PER_EMBED;
    
    embed.addFields(pagePlayers);
    
    const navigationRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prev')
            .setEmoji(EMOJI_PREV)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId('next')
            .setEmoji(EMOJI_NEXT)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages - 1),
        new ButtonBuilder()
            .setCustomId('close')
            .setEmoji(EMOJI_CLOSE)
            .setStyle(ButtonStyle.Danger)
    );

    const selectMenuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('player')
            .setPlaceholder('Selecciona un jugador')
            .addOptions(pagePlayers.map((player, index) => {
                const globalIndex = startPosition + index;
                return new StringSelectMenuOptionBuilder()
                    .setValue(`${globalIndex}`) 
                    .setLabel(player.originalName);
            }))
    );

    return { 
        content: '',
        embeds: [embed],
        components: [selectMenuRow, navigationRow],
        currentPage: currentPage, 
        totalPages: totalPages 
    };
}


/**
 * @param {ChatInputCommandInteraction} interaction 
 */
async function createEmbedLeaderboard(interaction) {
    const players = await getVenezuelaLeaderboard();
    if (players.length === 0) {
        await interaction.editReply('Ha ocurrido un error desconocido o no hay jugadores retirados para mostrar.');
        return; 
    }
    
    const pages = getLeaderboardPages(players);
    const totalPages = pages.length;
    let currentPage = 0;

    let message = createEmbedPage(pages[currentPage], currentPage, totalPages, players);
    
    try {
        const response = await interaction.editReply(message);
        let confirmation = null;
        
        const collectorFilter = i => i.user.id === interaction.user.id;
        
        while (true) {
            if (confirmation) {
                await confirmation.editReply(message);
            }

            try {
                confirmation = await response.awaitMessageComponent(
                    {
                        filter: collectorFilter,
                        time: 300000 // 5 min
                    }
                );
            } catch (e) {
                if (e.message === ERROR_TIMEOUT_MESSAGE) {
                    message.components.forEach(rows => {
                        rows.components.forEach(component => component.setDisabled(true));
                    });
                    await interaction.editReply(message);
                    return;
                }
                throw e;
            }
            
            await confirmation.deferUpdate();

            if (confirmation.customId === 'close') {
                message.components.forEach(rows => {
                    rows.components.forEach(component => component.setDisabled(true));
                });
                await confirmation.editReply(message);
                break;
            } else if (confirmation.customId === 'next') {
                if (currentPage < totalPages - 1) {
                    currentPage++;
                    message = createEmbedPage(pages[currentPage], currentPage, totalPages, players);
                }
            } else if (confirmation.customId === 'prev') {
                if (currentPage > 0) {
                    currentPage--;
                    message = createEmbedPage(pages[currentPage], currentPage, totalPages, players);
                }
            } else if (confirmation.customId === 'player') {
                const playerGlobalIndex = parseInt(confirmation.values[0]);
                let embedProfileMessage = null;
                try {
                    const embedProfile = await playerProfile.createEmbedProfile(
                        undefined, undefined, undefined, 
                        players[playerGlobalIndex].playerId
                    );

                    if (!embedProfile) {
                        await confirmation.editReply({
                            embeds: [],
                            content: 'Ha ocurrido un error desconocido al cargar el perfil. Intenta de nuevo más tarde.',
                            components: []
                        });
                        break;
                    }

                    embedProfileMessage = {
                        content: '',
                        embeds: [embedProfile],
                        components: [
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('back_to_leaderboard')
                                    .setLabel('Volver al ranking')
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('close_profile')
                                    .setEmoji(EMOJI_CLOSE)
                                    .setStyle(ButtonStyle.Danger)
                            )
                        ]
                    };

                    await confirmation.editReply(embedProfileMessage);

                    let profileConfirmation = await response.awaitMessageComponent({
                        filter: collectorFilter,
                        time: 300000 // 5 min
                    });

                    await profileConfirmation.deferUpdate();

                    if (profileConfirmation.customId === 'close_profile') {
                        embedProfileMessage.components.forEach(rows => rows.components.forEach(c => c.setDisabled(true)));
                        await profileConfirmation.editReply(embedProfileMessage);
                        break;
                    } else if (profileConfirmation.customId === 'back_to_leaderboard') {
                        confirmation = profileConfirmation; 
                    }
                } catch (e) {
                    if (e.message !== ERROR_TIMEOUT_MESSAGE) {
                        logger.ERR(e);
                        await interaction.editReply({
                            embeds: [], content: 'An unknown error has occurred in profile view', components: []
                        });
                    } else if (embedProfileMessage) {
                        embedProfileMessage.components.forEach(rows => rows.components.forEach(component => component.setDisabled(true)));
                        await interaction.editReply(embedProfileMessage);
                    }
                    break; 
                }
            }
        }
    } catch (e) {
        if (e.message !== ERROR_TIMEOUT_MESSAGE) {
            logger.ERR(e);
            try {
                await interaction.editReply({
                    embeds: [], content: 'An unknown error has occurred', components: []
                });
            } catch (err) {
                if (err.code !== RESTJSONErrorCodes.UnknownInteraction && err.code !== RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged) {
                    logger.ERR(err);
                }
            }
        } else {
            message.components.forEach(rows => rows.components.forEach(component => component.setDisabled(true)));
            try {
                await interaction.editReply(message);
            } catch (err) {
                 if (err.code !== RESTJSONErrorCodes.UnknownInteraction && err.code !== RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged) {
                    logger.ERR(err);
                }
            }
        }
    }
}


/**
 * Executes the main logic for the command, handling the interaction
 * and initiating the leaderboard creation process.
 * 
 * @param {Client} _client - The Discord client instance (unused in this specific logic).
 * @param {Db} _database - The MongoDB database connection instance (unused in this specific logic).
 * @param {ChatInputCommandInteraction} interaction - The interaction object received from Discord.
 */
async function execute(_client, _database, interaction) {
    try {
        await interaction.deferReply();
        await createEmbedLeaderboard(interaction)
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