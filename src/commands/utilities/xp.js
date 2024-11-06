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

const { ChatInputCommandInteraction, EmbedBuilder } = require("discord.js")
const { Db } = require("mongodb")

/**
 * 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(database, interaction) {
    if (interaction.member.id === '591640548490870805') {
        const top_xp = await database.collection('config').findOne(
            {
                type: 'top_xp'
            });

        if (!top_xp) {
            return await interaction.reply('La lista de usuarios no está disponible <:ani_okitathinking:1244840221376512021>')
        }

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
            description += `<:estrella_gris:1303810481911238726> ${formatNumber(position++)} <@${top_xp.usersList[i].id}> | XP: \`${top_xp.usersList[i].xp}\` ${top_xp.usersList[i].id === interaction.member.id ? '**<**' : ''}\n`
        }

        embed.setDescription(description)

        await interaction.reply({ embeds: [embed] })
    } else {
        await interaction.reply('Comando no disponible!')
    }
}

module.exports = {
    execute
}