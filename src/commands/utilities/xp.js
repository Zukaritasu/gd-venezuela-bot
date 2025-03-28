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

const { ChatInputCommandInteraction, EmbedBuilder, Message } = require("discord.js")
const { Db } = require("mongodb")
const logger = require('../../logger')

/**
 * 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction | Message} interaction 
 * @returns {Promise<EmbedBuilder>}
 */
async function getTop15XPEmbed(database, interaction) {
    const top_xp = await database.collection('config').findOne(
        {
            type: 'top_xp'
        });

    if (!top_xp || !('usersList' in top_xp))
        return null
        
    const embed = new EmbedBuilder()
    embed.setColor(0x2b2d31)
    embed.setTitle(`TOP 15 XP TEXTO`)
    embed.setFooter({ text: `GD Venezuela` })
    embed.setTimestamp()
    embed.setThumbnail(`https://cdn.discordapp.com/icons/1119795689984102455/${interaction.guild.icon}.png`)

    embed.setAuthor({
        name: 'Venezuela',
        iconURL: 'https://flagcdn.com/w640/ve.png'
    })

    let description = '';
    let position = 1

    const formatNumber = (num) => {
        const str = num.toString();
        if (str.length === 1) {
            return `\u2002\`${str}\``;
        }
        return `\`${str}\``;
    }

    for (let i = 0; i < top_xp.usersList.length && i < 15; i++) {
        const member = await interaction.guild.members.fetch(top_xp.usersList[i].id)
        let userName = '';
        if (!member) {
            userName = '<Usuario desconocido>';
        } else {
            userName = `[${member.user.username}](${member.user.displayAvatarURL({ dynamic: true })})`;
        }
        description += `<:estrella2:1303859148877987880> ${formatNumber(position++)} ${userName} | XP: \`${top_xp.usersList[i].xp}\` ${top_xp.usersList[i].id === interaction.member.id ? '**<**' : ''}\n`
    }

    logger.DBG(description.length)

    embed.setDescription(description)
    return embed
}

/**
 * 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(database, interaction) {
    try {
        const embed = await getTop15XPEmbed(database, interaction)
        if (!embed)
            return await interaction.reply('La lista de usuarios no está disponible <:ani_okitathinking:1244840221376512021>')
        await interaction.reply({ embeds: [embed] })
    } catch (error) {
        console.error(error)
        try {
            await interaction.reply({ 
                content: 'Ups! Ha ocurrido un error. Intenta mas tarde... <:birthday2:1249345278566465617>' 
            })
        } catch (e) {
            
        }
    }
}

module.exports = {
    getTop15XPEmbed,
    execute
}