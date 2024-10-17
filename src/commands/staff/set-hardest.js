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

const { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, GuildMember } = require('discord.js');
const { states } = require('../../../.botconfig/country-states.json')
const https = require('https');
const { Db } = require('mongodb');
const utils = require('../../utils');

//
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//

/**
 * 
 * @param {Number} level 
 * @returns Object
 */
function getResponseJSON(level) {
    return new Promise(function (resolve, reject) {
        https.get(`https://www.pointercrate.com/api/v2/demons/listed?limit=1&after=${--level}`, res => {
            let data = [];
            res.on('data', chunk => { data.push(chunk); });
            res.on('end', () => { resolve(JSON.parse(Buffer.concat(data).toString())) });
            res.on('error', err => { reject(err); })
        });
    });
}

/**
 * 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 * @param {string} username 
 * @param {string} memberId Discord member ID
 * @param {string} videoUrl YouTube video link
 * @param {*} levelId Level ID in Pointercrate
 * @param {*} stateName Name of the country state
 */
async function updateHardest(database, interaction, username, memberId, videoUrl, levelId, stateName) {
    try {
        let hardest = await database.collection('config').findOne({ type: 'hardest' })
        let result = null;
        if (hardest === null) {
            result = await database.collection('config').insertOne(
                hardest = {
                    type: 'hardest',
                    username: username,
                    memberId: memberId,
                    videoUrl: videoUrl,
                    levelId: levelId,
                    stateName: stateName
                });
        } else {
            result = await database.collection('config').updateOne(
                { _id: hardest._id },
                {
                    $set: {
                        username: username,
                        memberId: memberId,
                        videoUrl: videoUrl,
                        levelId: levelId,
                        stateName: stateName
                    }
                }
            )
        }

        await interaction.editReply(result.acknowledged ? 'The change was successful!' :
            'An error occurred while inserting the information');
    } catch (e) {
        console.error(e)
        await interaction.editReply('An unknown error occurred while changing the bot language');
    }
}

/**
 * 
 * @param {ChatInputCommandInteraction} interaction
 */
async function validateUserInfo(interaction) {
    const member = interaction.guild.members.cache
        .get(interaction.options.getUser('user', false).id);
    if (member === undefined) {
        return {
            error: true,
            message: 'The user could not be found on the server'
        }
    }

    const validRoles = states.map(state => state.roleId);
    const stateResult = member.roles.cache.map(role => role.id)
        .find(roleId => validRoles.includes(roleId));
    if (!stateResult) {
        return {
            error: true,
            message: 'The user does not have a country status role assigned'
        }
    }

    const videoUrl = interaction.options.getString('ytvideo', false);
    if (!utils.isValidYouTubeUrl(videoUrl)) {
        return {
            error: true,
            message: 'Invalid link (YouTube)'
        }
    }

    const position = utils.isValidPointercrateUrl(
        interaction.options.getString('level', false));
    if (position === null) {
        return {
            error: true,
            message: 'Invalid link (Pointercrate)'
        }
    }

    const response = await getResponseJSON(position)
    if (response instanceof Error) {
        return {
            error: true,
            message: 'An error occurred while checking the level'
        }
    }

    return {
        error: false,
        videoUrl: videoUrl,
        memberId: member.id,
        stateName: states.find(state => state.roleId === stateResult).name,
        levelId: response[0].id
    }
}

/**
 * 
 * @param {*} _client 
 * @param {*} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, database, interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        if (!utils.isAdministrator(interaction.member)) {
            await interaction.editReply('No tienes privilegios suficientes para realizar esta acción');
        } else {
            const userInfo = await validateUserInfo(interaction, interaction.options.getUser('user', false))
            if (userInfo.error) {
                await interaction.editReply(userInfo.message);
            } else {
                updateHardest(database, interaction,
                    interaction.options.getString('player', false),
                    userInfo.memberId,
                    userInfo.videoUrl,
                    userInfo.levelId,
                    userInfo.stateName
                )
            }
        }
    } catch (e) {
        console.error(e)
        await interaction.editReply('An unknown error has occurred');
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff_hardest')
        .setDescription('Define el hardest del país (solo personal autorizado)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Selecciona el jugador')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('player')
                .setDescription('Nombre del jugador')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('level')
                .setDescription('Enlace del nivel en Pointercrate')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('ytvideo')
                .setDescription('Enlace del video de YouTube')
                .setRequired(true)),
    execute,
};