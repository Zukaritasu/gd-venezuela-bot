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

const { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, GuildMember, MessageFlags } = require('discord.js');
const { states } = require('../../../.botconfig/country-states.json')
const { COLL_CONFIG } = require('../../../.botconfig/database-info.json');
const https = require('https');
const aredlapi = require('../../apis/aredlapi')
const { Db } = require('mongodb');
const utils = require('../../utils');
const logger = require('../../logger');

/**
 * @typedef {Object} CountryHardest
 * @property {string} videoUrl - The YouTube video URL for the hardest country level attempt.
 * @property {string} stateName - The name of the country state role assigned to the player.
 * @property {number} levelId - The GD level ID retrieved from the ArelDAPI service.
 * @property {string} levelName - The name of the level as returned by the API.
 * @property {number} attemps - The number of attempts used to complete the level.
 * @property {string} memberId - The Discord member ID of the player.
 * @property {string} username - The player's username associated with the submission.
 */

/**
 * Update or insert the hardest country level record in the database.
 * The function coerces incoming values to primitives to prevent malicious payloads
 * and uses an upsert operation to simplify insertion and update logic.
 * 
 * @param {Db} database
 * @param {CountryHardest} countryHardest
 * @returns {Promise<boolean>}
 */
async function updateHardest(database, countryHardest) {
    try {
        const collection = database.collection(COLL_CONFIG);
        const sanitizedRecord = {
            type: 'hardest',
            username:   String(countryHardest.username  || ''),
            memberId:   String(countryHardest.memberId  || ''),
            videoUrl:   String(countryHardest.videoUrl  || ''),
            levelId:    Number(countryHardest.levelId   || 0),
            stateName:  String(countryHardest.stateName || ''),
            attemps:    Number(countryHardest.attemps   || 0)
        };

        const result = await collection.updateOne(
            { type: 'hardest' },
            { $set: sanitizedRecord },
            { upsert: true }
        );

        return Boolean(result.acknowledged);
    } catch (e) {
        logger.ERR(e);
    }

    return false;
}

/**
 * Normalize and validate interaction data for the hardest country level submission.
 * Checks the selected user, verifies the state role, validates the YouTube URL,
 * confirms the attempt count, and fetches level information from the API.
 *
 * @param {ChatInputCommandInteraction} interaction - The interaction object from Discord.js
 * @returns {Promise<CountryHardest>} - A promise that resolves to a normalized CountryHardest object
 */
async function getCountryHardestNormalized(interaction) {
    const member = interaction.guild.members.cache.get(interaction.options.getUser('user', false)?.id);
    if (member == null) {
        throw new Error('The user is not a member of this server');
    }

    const validRoles = states.map(state => state.roleId);
    const stateRoleId = member.roles.cache.map(role => role.id).find(roleId => validRoles.includes(roleId));
    if (stateRoleId == null) {
        throw new Error('The user does not have a country status role assigned');
    }

    /** @type {CountryHardest} */
    const countryHardest = {}
    const videoUrl = interaction.options.getString('ytvideo', false);
    if (!utils.isValidYouTubeUrl(videoUrl)) {
        throw new Error('Invalid YouTube URL provided');
    }

    countryHardest.videoUrl = videoUrl;

    const attemps = interaction.options.getInteger('attemps', false)
    if (attemps <= 0) {
        throw new Error('The number of attempts is invalid, please enter a value greater than 0');
    }

    countryHardest.attemps = attemps;

    const demonInfo = await aredlapi.getLevel(interaction.options.getInteger('level_id', false))
    if (demonInfo instanceof Error) {
        throw demonInfo
    }

    countryHardest.levelId = demonInfo.level_id;
    countryHardest.levelName = demonInfo.name;
    countryHardest.memberId = member.id;
    countryHardest.username = interaction.options.getString('player', false);
    countryHardest.stateName = states.find(state => state.roleId === stateRoleId).name;

    return countryHardest
}

/**
 * Executes the command to set the hardest country level.
 * 
 * @param {Client} _client - The Discord client
 * @param {Db} database - The MongoDB database instance
 * @param {ChatInputCommandInteraction} interaction - The interaction object from Discord.js
 * 
 * @returns {Promise<void>}
 */
async function execute(_client, database, interaction) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        if (!utils.isAdministrator(interaction.member)) {
            return await interaction.editReply('No tienes privilegios suficientes para realizar esta acción');
        }

        await updateHardest(database, await getCountryHardestNormalized(interaction))
        await interaction.editReply('Se ha actualizado correctamente!');
    } catch (e) {
        logger.ERR(e);
        try {
            await interaction.editReply(e?.message || 'An unknown error has occurred');
        } catch {
            // ignore, the interaction might have already been replied to or deferred
        }
    }
}

module.exports = { execute };