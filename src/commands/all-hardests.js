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

const { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } = require('discord.js');
const { Db } = require('mongodb');

//
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//

/**
 * 
 * @param {Db} database 
 */
async function createEmbedList(database) {
    let fields = []

    try {
        const hardests = database.collection('states')
        const countryHardest = await database.collection('config').findOne({ type: 'hardest' })

        const getTrophy = (player) => {
            if (countryHardest) {
                if (countryHardest.username === player) {
                    return ' <:top1_trofeo:1301284275110416404>'
                }
            }
            return ''
        }

        for await (const doc of hardests.find()) {
            fields.push(
                {
                    name: doc.stateName,
                    value: `${doc.player}${getTrophy(doc.player)} / ${doc.levelName}`,
                    inline: true
                })
        }
    } catch (e) {
        console.error(e)
        return { content: 'An error occurred while querying the database information' };
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
 * 
 * @param {*} _client 
 * @param {*} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, database, interaction) {
    await interaction.deferReply();
    try {
        await interaction.editReply(await createEmbedList(database))
    } catch (e) {
        console.error(e)
        try {
            await interaction.editReply('An unknown error has occurred. Please try again later')
        } catch (err) {

        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hardests')
        .setDescription('Todos los Hardest del país'),
    execute,
};