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

const EMBED_COLOR = 0x2b2d31 /** Black */
const ERROR_TIMEOUT_MESSAGE = 'Collector received no interactions before ending with reason: time'

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
                originalName: response[i].name,
                    name: utils.escapeDiscordSpecialChars(response[i].name),
                value: `${response[i].score > 0 ? `${response[i].score.toFixed(2)} puntos\n` : ''} ${await getPlayerInfo(response[i].id)}`
                    .concat(`${response[i].banned ? '\n***banned***' : ''}`), // to string
                playerId: response[i].id,
                inline: true
            })
        }
    }

    players.sort((a, b) => b.score - a.score);

    return players;
}

/**
 * @param {ChatInputCommandInteraction} interaction 
 */
async function createEmbedLeaderboard(interaction) {
    const players = await getVenezuelaLeaderboard()
    if (players.length === 0) {
        await interaction.editReply('Ha ocurrido un error desconocido');
    } else {
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

        const message = { 
            content: '',
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('player')
                        .setPlaceholder('Selecciona un jugador')
                        .addOptions((() => {
                            const options = []
                            players.forEach(player => options.push(
                                new StringSelectMenuOptionBuilder().setValue(`${options.length}`)
                                    .setLabel(player.originalName)
                                )
                            )
                            return options
                        })())),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close')
                            .setEmoji('<:closeicon:1219429070266437693>')
                        .setStyle(ButtonStyle.Danger)
            )]
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
                } else if (confirmation.customId === 'player') {
                    let embedProfileMessage = null
                    try {
                        const embedProfile = await playerProfile.createEmbedProfile(undefined, undefined, undefined, 
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
                                            .setEmoji('<:goback:1295223304205897730>')
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
                    console.error(e)
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
                console.error(err)
            }
        }
    }
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