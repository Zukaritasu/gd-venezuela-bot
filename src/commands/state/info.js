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
const { states } = require('../../../.botconfig/country-states.json');
const { Db } = require('mongodb');
const utils = require('../../utils')
const aredlapi = require('../../aredlapi')
const { COLL_STATES } = require('../../../.botconfig/database-info.json');
const logger = require('../../logger');

////////////////////////////////////////////

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

    let hardest = await database.collection(COLL_STATES).findOne({ stateId: `${stateId}` })
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
        creatorPts: 0,     /* 1216234978673819798 */
        userCoinGdr: 0,    /* 1221273094035865771 */
        demonGdr: 0        /* 1119805100857237524 */
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
    const demonGdrRoleId = '1119805100857237524';
    const moonGdrRoleId = '1216242788358688859';
    const creatorPtsRoleId = '1216234978673819798';
    const userCoinGdrRoleId = '1221273094035865771';

    await interaction.guild.members.fetch()
    const members = interaction.guild.members.cache.filter(member => member.roles.cache.has(roleId))

    info.players = members.size;
    info.starGdr = members.filter(member => member.roles.cache.has(starGdrRoleId)).size;
    info.extremeDms = members.filter(member => member.roles.cache.has(extremeDmsRoleId)).size;
    info.moonGdr = members.filter(member => member.roles.cache.has(moonGdrRoleId)).size;
    info.creatorPts = members.filter(member => member.roles.cache.has(creatorPtsRoleId)).size;
    info.userCoinGdr = members.filter(member => member.roles.cache.has(userCoinGdrRoleId)).size;
    info.demonGdr = members.filter(member => member.roles.cache.has(demonGdrRoleId)).size;

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
 * @param {ChatInputCommandInteraction} interaction 
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

    //if (interaction.member.id === '591640548490870805') {
    const getNumberToString = (number) => {
        const strSpaces = '          '
        return strSpaces.substring(0, strSpaces.length - number.toString().length).concat(number.toString())
    }

    const levels = await aredlapi.getLevels()
    let levelName = `**${info.hardest}**`
    if (!(levels instanceof Error)) {
        const result = levels.find(level => level.name === info.hardest)
        if (result) {
            levelName = `${levelName} #${result.position}`
        }
    }

    embed.addFields(
        { name: 'Hardest de Estado', value: levelName, inline: true },
        { name: 'Completado por', value: `**${utils.escapeDiscordSpecialChars(info.player)}**`, inline: true },
        { name: 'Cantidad de jugadores', value: `<:user:1302725281420673164> \`${getNumberToString(info.players)}\``, inline: false },
        {
            name: 'Cantidad de jugadores grinders',
            value: `<:StarA:1302308005869649920> \`${getNumberToString(info.starGdr)}\`\n<:Moon:1302308034412019803> \`${getNumberToString(info.moonGdr)}\`\n<:ExtremeDemon:1302310587765883042> \`${getNumberToString(info.extremeDms)}\`\n<:Demon:1302308056918655040> \`${getNumberToString(info.demonGdr)}\`\n<:CreatorPoints:1302308069010706474> \`${getNumberToString(info.creatorPts)}\`\n<:UserCoinVerified:1302308078703874172> \`${getNumberToString(info.userCoinGdr)}\`\n`,
            inline: false
        }
    )

    embed.setAuthor({
        name: 'Venezuela',
        iconURL: 'https://flagcdn.com/w640/ve.png'
    })

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
                logger.ERR(e)
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
        } catch {

        }

    }

    return null
}

/**
 * @returns Message
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
 * @param {*} _client 
 * @param {*} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, database, interaction) {
    await interaction.deferReply();
    let response = await interaction.editReply(createStateSelector());
    let confirmation = null;

    try {
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
                logger.ERR(e)
                await interaction.editReply(
                    {
                        embeds: [],
                        content: 'An unknown error has occurred',
                        components: []
                    }
                );
            }
        } catch {

        }
    }
}

module.exports = {
    execute
};
