/**
 * Copyright (C) 2024 - 2026 Zukaritasu
 * 
 * This program is free software: you can redistribute it and/or modify
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

const { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Client } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../logger');
const utils = require('../utils');
const { COLL_STATES, COLL_CONFIG } = require('../../.botconfig/database-info.json');

/**
 * Creates an embed with the list of the country's hardest demons.
 *
 * @param {Db} database - The MongoDB database instance.
 * @returns {Promise<object>} A Discord reply payload containing the embed.
 */
async function createEmbedList(database) {
    let fields = []

    const hardests = database.collection(COLL_STATES)
    const countryHardest = await database.collection(COLL_CONFIG).findOne({ type: 'hardest' })

    const getTrophy = (player) => {
        if (countryHardest && countryHardest.username === player) {
            return ' <:top1_trofeo:1301284275110416404>'
        }

        return ''
    }

    for await (const doc of hardests.find()) {
        fields.push({
            name: doc.stateName,
            value: `${doc.player}${getTrophy(doc.player)} / ${doc.levelName}`,
            inline: true
        })
    }

    const embed = new EmbedBuilder()
    embed.setColor(0x2b2d31)
    embed.setTitle(`HARDESTS DEL PAIS`)
    embed.addFields(fields)
    embed.setTimestamp()
    embed.setFooter({ text: `GD Venezuela` })
    embed.setThumbnail('https://cdn.discordapp.com/attachments/1041060604850483404/1294740130422063189/Epic_Extreme_Demon.png')
    embed.setAuthor({
        name: 'Venezuela',
        iconURL: 'https://flagcdn.com/w640/ve.png'
    })

    return { embeds: [embed] };
}

/**
 * Handles the /hardests command by deferring the reply, building the 
 * embed list, and editing the reply.
 *
 * @param {Client} _client - Discord client instance (unused).
 * @param {Db} database - The MongoDB database instance.
 * @param {ChatInputCommandInteraction} interaction - The command interaction.
 * @returns {Promise<void>}
 */
async function execute(_client, database, interaction) {
    try {
        await interaction.deferReply();
        await interaction.editReply(await createEmbedList(database))
    } catch (e) {
        logger.ERR(e)
        try {
            await utils.reply(interaction, 'An unknown error has occurred. Please try again later')
        } catch {

        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hardests')
        .setDescription('Todos los Hardests del país'),
    execute,
};