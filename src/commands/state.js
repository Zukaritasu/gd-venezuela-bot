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

const { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder,
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder,
    ButtonStyle, ButtonBuilder } = require('discord.js');
const { states } = require('../../.botconfig/country-states.json');
const { Db } = require('mongodb');
const utils = require('../utils')

//
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//

const ERROR_TIMEOUT_MESSAGE = 'Collector received no interactions before ending with reason: time'

/**
 * 
 * @param {Db} database 
 * @returns 
 */
async function getHardestStateInfo(database, stateId /* <roleId> */) {
    let info = {
        levelName: 'unknown',
        player: 'unknown',
        ytVideo: null
    }

    let hardest = await database.collection('states').findOne({ stateId: `${stateId}` })
    if (hardest !== null) {
        info.levelName = hardest.levelName
        info.player = hardest.player
        info.ytVideo = hardest.ytVideo
    }

    return info;
}

/**
 * 
 * @param {ChatInputCommandInteraction} interaction 
 * @param {string} roleId 
 */
async function getStateInfo(database, interaction, roleId) {
    let info = {
        stateName: 'unknown',
        stateFlag: null,
        hardest: 'unknown',
        player: 'unknown', /* player who has the hardest in the state */
        videoImage: null,
        ytVideo: null,
        players: 0,
        starGdr: 0,        /* 1216240462742950020 */
        extremeDms: 0,     /* 1225498328754552914 */
        moonGdr: 0,        /* 1216242788358688859 */
        creatorPts: 0      /* 1216234978673819798 */
    }

    // get state info

    info.stateName = states.find(state => state.roleId === `${roleId}`).name //interaction.guild.roles.cache.get(roleId);
    info.stateFlag = states.find(state => state.roleId === `${roleId}`).flagUrl

    //******************** */

    // get hardest state

    const hardestInfo = await getHardestStateInfo(database, roleId)

    info.player = hardestInfo.player
    info.hardest = hardestInfo.levelName
    info.ytVideo = hardestInfo.ytVideo

    if (info.ytVideo === null || info.ytVideo.length === 0) {
        /* Alternative image link in case the video link is missing */
        info.videoImage = 'https://media.discordapp.net/attachments/1037758697990000672/1295422400145395823/video-not-available.png'
    } else {
        info.videoImage = await utils.getYouTubeThumbnail(hardestInfo.ytVideo)
    }

    //******************** */

    const starGdrRoleId = '1216240462742950020';
    const extremeDmsRoleId = '1225498328754552914';
    const moonGdrRoleId = '1216242788358688859';
    const creatorPtsRoleId = '1216234978673819798';

    const members = interaction.guild.members.cache
        .filter(member => member.roles.cache.has(roleId))

    info.players = members.size;
    info.starGdr = members.filter(member => member.roles.cache.has(starGdrRoleId)).size;
    info.extremeDms = members.filter(member => member.roles.cache.has(extremeDmsRoleId)).size;
    info.moonGdr = members.filter(member => member.roles.cache.has(moonGdrRoleId)).size;
    info.creatorPts = members.filter(member => member.roles.cache.has(creatorPtsRoleId)).size;

    return info;
}

/**
 * 
 * @param {*} interaction 
 * @returns 
 */
function createEmbedTable(_interaction, option) {
    const row = new ActionRowBuilder()
    const componentsBtns = []

    const backButton = new ButtonBuilder()
    backButton.setCustomId('back')
    backButton.setEmoji('<:goback:1295223304205897730>')
    backButton.setStyle(ButtonStyle.Primary)
    componentsBtns.push(backButton)

    const followButton = new ButtonBuilder()
    followButton.setCustomId('close')
    followButton.setEmoji('<:closeicon:1219429070266437693>')
    followButton.setStyle(ButtonStyle.Danger)
    componentsBtns.push(followButton)

    row.addComponents(componentsBtns);

    return { content: 'Okay', embeds: [], components: [row] }
}

/**
 * @param {*} response 
 * @param {*} confirmation 
 * @param {*} interaction 
 * @param {*} collectorFilter 
 * @returns {Promise}
 */
async function showStateInfo(database, response, confirmation, interaction, collectorFilter) {
    const info = await getStateInfo(database, interaction, confirmation.values[0])

    const embed = new EmbedBuilder()
    embed.setColor(0x2b2d31)
    embed.setTitle(`${info.stateName}`)
    //embed.setDescription(description)
    embed.setFooter({ text: `GD Venezuela` })
    embed.setThumbnail(info.stateFlag)
    embed.setTimestamp()

    embed.addFields(
        { name: 'Hardest', value: `${info.hardest}`, inline: true },
        { name: 'Vencedor', value: `${info.player}`, inline: true },
        { name: 'Jugadores', value: `${info.players}`, inline: true },
        { name: 'Star Grinders', value: `${info.starGdr}`, inline: true, index: 0 },
        { name: 'Extreme Demons', value: `${info.extremeDms}`, inline: true, index: 1 },
        { name: 'Moon Grinders', value: `${info.moonGdr}`, inline: true, index: 2 },
        { name: 'Creator Points', value: `${info.creatorPts}`, inline: true, index: 3 }
    )

    if (info.videoImage !== null) {
        embed.setImage(info.videoImage)
    }

    const row = new ActionRowBuilder()
    const componentsBtns = []

    const backButton = new ButtonBuilder()
    backButton.setCustomId('back')
    backButton.setEmoji('<:goback:1295223304205897730>')
    backButton.setStyle(ButtonStyle.Primary)
    componentsBtns.push(backButton)

    const followButton = new ButtonBuilder()
    followButton.setCustomId('close')
    followButton.setEmoji('<:closeicon:1219429070266437693>')
    followButton.setStyle(ButtonStyle.Danger)
    componentsBtns.push(followButton)

    let videoButton = null
    if (info.ytVideo) {
        videoButton = new ButtonBuilder()
        videoButton.setLabel('Ver Video')
        videoButton.setURL(info.ytVideo)
        videoButton.setStyle(ButtonStyle.Link)
        componentsBtns.push(videoButton)
    }

    row.addComponents(componentsBtns);

    const message = { content: '', embeds: [embed], components: [row] }

    /* The menu of options is created depending on the number of users
    per statistic in the game (grinder) */

    /*let menuOptions = []

    embed.data.fields.forEach(field => {
        if ('index' in field) {
            menuOptions.push(new StringSelectMenuOptionBuilder()
                .setLabel(field.name)
                .setValue(`${field.index}`)
            )
        }
    })

    if (menuOptions.length > 0) {
        message.components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('option')
                .setPlaceholder('Selecciona una opción')
                .addOptions(menuOptions)))
    }*/

    /*-----------*/

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
            } else if (confirmation.customId === 'option') {
                const messageTable = createEmbedTable(interaction, confirmation.values[0])
                await confirmation.update(messageTable)
                try {
                    confirmation = await response.awaitMessageComponent(
                        {
                            filter: collectorFilter,
                            time: 300000 // 5 min
                        }
                    );
                } catch (error) {
                    messageTable.components.forEach(rows => rows.components
                            .forEach(component => component.setDisabled(true)))
                    await interaction.editReply(
                        {
                            embeds: [embed],
                            components: message.components
                        }
                    );
                    break;
                }

                if (confirmation.customId === 'close') {
                    await response.delete(); break;
                }
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
                        if (videoButton !== component) {
                            component.setDisabled(true)
                        }
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

        }

    }

    return null
}

/**
 * @returns Message
 */
function creaeStateSelector() {
    const cb = new StringSelectMenuBuilder()
    cb.setCustomId('state')
    cb.setPlaceholder('Seleccionar')

    for (let i = 0; i < states.length; i++) {
        cb.addOptions(new StringSelectMenuOptionBuilder()
            .setLabel(states[i].name)
            .setValue(states[i].roleId)
        );
    }

    return {
        content: 'Selecciona un estado del país',
        components: [new ActionRowBuilder().addComponents(cb)],
        embeds: []
    }
}

/**
 * 
 * @param {*} _client 
 * @param {*} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, database, interaction) {
    await interaction.deferReply();
    let response = await interaction.editReply(creaeStateSelector());
    let confirmation = null;

    try {
        while (true) {
            if (confirmation !== null) {
                await confirmation.update(creaeStateSelector())
            }

            const collectorFilter = i => i.user.id === interaction.user.id;
            confirmation = await response.awaitMessageComponent(
                {
                    filter: collectorFilter,
                    time: 300000 // 5 min
                }
            );

            confirmation = await showStateInfo(database, response, confirmation,
                interaction, collectorFilter)
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
    data: new SlashCommandBuilder()
        .setName('state-info')
        .setDescription('Muestra la información de un estado del país'),
    execute,
};
