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

const { ChatInputCommandInteraction, ActionRowBuilder,
    ButtonBuilder, ButtonStyle,
    Client } = require('discord.js');
const utils = require('../../utils');
const { Db } = require('mongodb');
const axios = require('axios');
const { GuildMember } = require('discord.js');
const { COLL_CREATOR_POINT_PLAYERS } = require('../../../.botconfig/database-info.json')
const logger = require('../../logger');

///////////////////////////////////

const ROLE_CREATOR_POINT_ID = '1216234978673819798'
const ERROR_TIMEOUT_MESSAGE = 'Collector received no interactions before ending with reason: time'

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
 * @param {string} playerName 
 */
async function getGJUsers20(playerName) {
    const data = new URLSearchParams({
        "secret": "Wmfd2893gb7",
        "str": playerName
    });

    return axios.post('http://www.boomlings.com/database/getGJUsers20.php', data, {
        headers: {
            'User-Agent': '',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
}

/**
 * 
 * @param {ChatInputCommandInteraction} interaction 
 * @param {string} response 
 * @returns 
 */
async function confirmUser(interaction, response) {
    const map = new Map();

    /* the response is converted into a map so that the information can be processed */
    const pairs = response.split(':');
    for (let i = 0; i < pairs.length; i += 2) 
        map.set(pairs[i], pairs[i + 1]);

    if (map.get('8') === '0') {
        return await interaction.editReply(':warning: The user has no creator points');
    }

    const message = `A user with the username ${map.get('1')} has been found. `
        .concat('Confirm if your statistics match the user you are looking for.\n\n')
        .concat(`stars ${map.get('3')}, demons ${map.get('4')}, creator points ${map.get('8')}`)

    let userResponse = await interaction.editReply({
        content: message,
        components: [
            new ActionRowBuilder().addComponents(new ButtonBuilder()
                .setCustomId('accept')
                .setLabel('Accept')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
            )
        ]
    })

    try {
        let confirmation = await userResponse.awaitMessageComponent(
            {
                time: 120000 // 2 min
            }
        );

        if (confirmation.customId === 'accept') {
            return {
                confirmation: confirmation,
                accountID: map.get('16')
            }
        } else {
            await interaction.deleteReply(userResponse)
        }
    } catch (e) {
        try { // try catch to ensure if a new exception occurs from calling the editReply method
            if (e.message === ERROR_TIMEOUT_MESSAGE) {
                await userResponse.delete()
            } else {
                logger.ERR(e)
                await interaction.editReply(
                    {
                        content: 'An unknown error has occurred',
                        components: []
                    }
                );
            }
        } catch {

        }
    }

    return null
}

/**
 * 
 * @param {ChatInputCommandInteraction} interaction 
 * @param {GuildMember} member 
 * @returns 
 */
async function verifyPlayerStatus(interaction, member) {
    if (member === undefined) {
        await interaction.editReply('The user is not available on the Discord server');
        return false
    } else if (member.roles.cache.find(role => role.id === ROLE_CREATOR_POINT_ID) === undefined) {
        await interaction.editReply('The user has not been assigned the role of creator points');
        return false
    }
    return true
}

/**
 * 
 * @param {Db} database 
 * @param {*} userResponse 
 * @param {GuildMember} member 
 */
async function saveUserAccount(database, userResponse, member) {
    try {
        let account = await database.collection(COLL_CREATOR_POINT_PLAYERS).findOne(
            { 
                accountID: userResponse.accountID 
            })

        let result = null
        if (account === null) {
            result = await database.collection(COLL_CREATOR_POINT_PLAYERS).insertOne(
                {
                    userID: member.id,    /* discord */
                    accountID: userResponse.accountID /* geometry dash id account */
                });
        }

        await userResponse.confirmation.update({
            components: [],
            content: result ===  null || result.acknowledged ? 
                'Successfully saved!' :
                'An error occurred while inserting the information'
        });
    } catch (e) {
        logger.ERR(e)
        try {
            await userResponse.confirmation.update(
            {
                content: 'An error occurred while saving the account information',
                components: []
            });
        } catch {
            
        }
    }
}

/**
 * 
 * @param {ChatInputCommandInteraction} interaction 
 * @param {*} database 
 */
async function processAccountCreatorPoint(interaction, database) {
    const response = `${(await getGJUsers20(interaction.options.getString('player', false))).data}`
    if (response === '-1') {
        await interaction.editReply('User not found');
    } else {
        const user = interaction.options.getUser('user', false);
        const member = interaction.guild.members.cache.find(member => member.id === user.id)
        if (await verifyPlayerStatus(interaction, member)) {
            const userResponse = await confirmUser(interaction, response)
            if (userResponse != null) {
                await saveUserAccount(database, userResponse, member)
            }
        }
    }
}

/**
 * 
 * @param {Client} _client 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, database, interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        if (!utils.isAdministrator(interaction.member))
            await interaction.editReply('No tienes privilegios suficientes para realizar esta acción');
        else
            await processAccountCreatorPoint(interaction, database);
    } catch (error) {
        logger.ERR(error)
        await interaction.editReply('An unknown error has occurred. Please try again later');
    }
}

module.exports = {
    execute
};