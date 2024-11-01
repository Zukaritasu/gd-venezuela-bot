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

const { ChatInputCommandInteraction, Client, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")
const { Db } = require("mongodb")
const robtopapi = require('../../robtopapi')

const { states } = require('../../../.botconfig/country-states.json');

const ERROR_TIMEOUT_MESSAGE = 'Collector received no interactions before ending with reason: time'

/**
 * 
 * @param {Db} database 
 * @param {string} userId 
 */
async function getUserStadistic(database, userId, stadistic) {
    try {
        const user = await database.collection('usersgd').findOne({ userId: userId })
        if (user !== null) {
            const response = await robtopapi.getGJUserInfo20(user.accountID)
            if (response != null) {
                let value = response.get(stadistic.key)
                if (value !== undefined) {
                    if (stadistic.key === 'demons') {
                        let number = 0
                        value.split(',').forEach(part => number += parseInt(part))
                        value = number.toString()
                    }

                    return parseInt(value)
                }
            }
        }
    } catch (error) {
        console.log(error)
    }

    return -1
}

/**
 * 
 * @param {*} database 
 * @param {*} response 
 * @param {*} confirmation 
 * @param {ChatInputCommandInteraction} interaction 
 * @param {*} collectorFilter 
 * @param {*} stadistic 
 * @returns 
 */
async function showStadistic(database, response, confirmation, interaction, collectorFilter, stadistic) {
    const grinders = interaction.guild.members.cache.filter(member =>
        member.roles.cache.find(role => role.id === '1119804850620866600' /* vnzl role */) !== undefined &&
        member.roles.cache.find(role => role.id === confirmation.values[0] /* state role id*/) !== undefined &&
        member.roles.cache.find(role => role.id === stadistic.roleId) !== undefined)

    //************** create embed **************/

    const embed = new EmbedBuilder()
    embed.setColor(0x2b2d31)
    embed.setTitle(`${states.find(state => state.roleId === confirmation.values[0]).name}`)
    embed.setFooter({ text: `GD Venezuela` })

    if (stadistic.thumbnail !== null)
        embed.setThumbnail(stadistic.thumbnail)
    embed.setTimestamp()

    embed.setAuthor({
        name: 'Venezuela',
        iconURL: 'https://flagcdn.com/w640/ve.png'
    })

    //************** end embed **************/

    if (grinders.size === 0) {
        embed.setDescription('No se encontraron jugadores grinders.')
    } else {
        let fields = []

        for (let i = 0; i < grinders.size && i < 24; i++) {
            const member = grinders.at(i)
            const number = await getUserStadistic(database, member.id, stadistic)
            fields.push({
                name:   member.user.username,
                number: number,
                value:  number === -1 ? 'no registrado': number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
                inline: true
            })
        }

        fields.sort((a, b) => b.number - a.number);

        embed.addFields(fields)
    }

    let message = {
        content: '',
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('back')
                .setEmoji('<:goback:1295223304205897730>')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('close')
                .setEmoji('<:closeicon:1219429070266437693>')
                .setStyle(ButtonStyle.Danger)
        )]
    }

    try {
        while (true) {
            await confirmation.update(message);
            confirmation = await response.awaitMessageComponent(
                {
                    filter: collectorFilter,
                    time: 300000 // 5 min
                }
            );

            if (confirmation.customId === 'back') {
                return confirmation
            } else {
                await response.delete(); break;
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

    return null
}

/**
 * 
 * @returns 
 */
function createStateSelector() {
    const cb = new StringSelectMenuBuilder()
    cb.setCustomId('state')
    cb.setPlaceholder('Seleccionar')

    const sortStates = states;
    sortStates.sort((a, b) => a.name.localeCompare(b.name))

    for (let i = 0; i < sortStates.length; i++) {
        cb.addOptions(new StringSelectMenuOptionBuilder()
            .setLabel(sortStates[i].name)
            .setValue(sortStates[i].roleId)
        );
    }

    return {
        content: 'Selecciona un Estado del país',
        components: [new ActionRowBuilder().addComponents(cb)],
        embeds: []
    }
}

/**
 * 
 * @param {Client} client 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 * @param {Object} stadistic 
 */
async function processStateStatistics(client, database, interaction, stadistic) {
    try {
        await interaction.deferReply();
        let response = await interaction.editReply(createStateSelector());
        let confirmation = null;

        while (true) {
            if (confirmation !== null) {
                await confirmation.update(createStateSelector())
            }

            const collectorFilter = i => i.user.id === interaction.user.id;
            confirmation = await response.awaitMessageComponent(
                {
                    filter: collectorFilter,
                    time: 300000 // 5 min
                }
            );

            confirmation = await showStadistic(database, response, confirmation,
                interaction, collectorFilter, stadistic)
            if (confirmation === null) {
                break;
            }
        }
    } catch (e) {
        try { // try catch to ensure if a new exception occurs from the call to the 
            // editReply method and the delete method
            if (e.message === ERROR_TIMEOUT_MESSAGE) {
                if (response)
                    await response.delete();
            } else {
                console.error(e);
                await interaction.editReply(
                    {
                        embeds: [],
                        content: 'An unknown error has occurred',
                        components: []
                    }
                );
            }
        } catch (err) {

        }
    }
}

module.exports = {
    processStateStatistics
}