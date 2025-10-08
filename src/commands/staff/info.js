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
const { states } = require('../../../.botconfig/country-states.json');
const { Db } = require('mongodb');
const utils = require('../../utils')

/////////////////////////////////////////////

const staffRolesID = [
    { 
        id: '1119804656923709512',
        emoji: '<:dictador:1297551465702756486>'
    }, /* Dictador */
    {
        id: '1119804806521946155',
        emoji: '<:tribunal:1302032213231272018>'
    }, /* Tribunal Supremo */
    {
        id: '1121221914254397592',
        emoji: '<:ministerio:1297551381690843136>'
    }  /* Ministerio */
]

/**
 * 
 * @param {*} _client 
 * @param {*} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, _database, interaction) {
    const membersId = []

    let categories = []
    staffRolesID.forEach(staffRole => {
        let category = { name: '\u200B', value: '', inline: true }
        //console.log(interaction.guild.roles.cache.find(role => role.id === staffRole.id).iconURL({ extension: 'png' }))
        category.value = `${staffRole.emoji} **${interaction.guild.roles.cache.find(role => role.id === staffRole.id)}**\n`

        const collection = interaction.guild.members.cache.filter(member => 
                    member.roles.cache.find(role => role.id === staffRole.id) !== undefined)
        collection.forEach(member => {
            if (member.id !== '953136140452495411' && membersId.indexOf(member.id) === -1) {
                membersId.push(member.id)
                category.value = category.value.concat(`- ${member.user.username}\n`)
            }
        })
        
        categories.push(category)
    })

    const embed = new EmbedBuilder()
    embed.setColor(0x2b2d31)
    embed.setTitle(`STAFF DEL SERVIDOR`)
    embed.setDescription('Para saber un poco más sobre el papel que realiza cada uno de estos roles, te invito a que visites el canal de <#1119803609773785159> para obtener más información. <a:gif_heartceleste:1257990800172908636>')
    embed.setFooter({ text: `GD Venezuela` })
    embed.setThumbnail(`https://cdn.discordapp.com/icons/1119795689984102455/${interaction.guild.icon}.png`)
    embed.setTimestamp()
    embed.addFields(categories)

    embed.setAuthor({
        name: 'Venezuela',
        iconURL: 'https://flagcdn.com/w640/ve.png'
    })

    interaction.reply({ embeds: [embed] })
}

module.exports = {
    execute
};