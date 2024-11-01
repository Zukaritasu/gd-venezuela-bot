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

const { SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');
const { states } = require('../../../.botconfig/country-states.json');
const { Db } = require('mongodb');
const utils = require('../../utils')

//
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//

/**
 * 
 * @param {*} interaction 
 * @param {*} database 
 * @param {*} stateId 
 * @param {*} player 
 * @param {*} level 
 * @param {*} ytVideo 
 */
async function updateStateHardest(interaction, database, stateId, player, level, ytVideo) {
    if(ytVideo && !utils.isValidYouTubeUrl(ytVideo)) {
        await interaction.editReply('Enlace invalido (YouTube)')
        return
    } 

    let stateInfo = await database.collection('states').findOne(
        { 
            stateId: `${stateId}` 
        })

    let result = null;
    if (stateInfo === null) {
        // if the state does not exist it is inserted in the db
        result = await database.collection('states').insertOne(
            {
                stateId: `${stateId}`,
                stateName: states.find(state => state.roleId === stateId).name,
                player: player,
                levelName: level,
                ytVideo: ytVideo ?? ''
            });
    } else {
        // the state's most difficult level is updated
        result = await database.collection('states').updateOne(
            { _id: stateInfo._id },
            {
                $set: {
                    player: player,
                    levelName: level,
                    ytVideo: ytVideo ?? ''
                }
            }
        )
    }

    if (!result.acknowledged) {
        await interaction.editReply('An error occurred while inserting the information');
        throw null
    }

    await interaction.editReply('The change was successful!');
}

/**
 * 
 * @param {*} _client 
 * @param {*} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, database, interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const role = interaction.options.getRole('state', false)
        if (states.find(state => state.roleId === role.id) === undefined)
            await interaction.editReply('The selected role does not correspond to a state of the country');
        else
            await updateStateHardest(
                interaction, 
                database, 
                role.id, 
                interaction.options.getString('player', false),
                interaction.options.getString('level', false),
                interaction.options.getString('youtube', false)
            )
    } catch (error) {
        console.error(error);
        await interaction.editReply('An unknown error has occurred');
    }
}

module.exports = {
    execute,
};
