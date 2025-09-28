/**
 * Copyright (C) 2025 Zukaritasu
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

const { ChatInputCommandInteraction } = require("discord.js")
const { Db } = require("mongodb")
const logger = require("../../logger")
const topLimits = require("../../../.botconfig/top-limits.json")


async function leave(database, interaction) {
	await interaction.deferReply({ ephemeral: true })
    await interaction.editReply('Esta función está deshabilitada temporalmente...')
}

async function join(database, interaction) {
	await interaction.deferReply({ ephemeral: true })
    await interaction.editReply('Esta función está deshabilitada temporalmente...')
}

async function position(database, interaction) {
    try {
        await interaction.deferReply({ ephemeral: true })
        const top_xp = await database.collection('config').findOne(
            {
                type: 'top_xp'
            });
    
        if (!top_xp || !('usersList' in top_xp))
            return await interaction.editReply('La lista de usuarios no está disponible <:ani_okitathinking:1244840221376512021>')
        const user = top_xp.usersList.find(user => user.id === interaction.member.id)
        if (!user)
            return await interaction.editReply(`Tu posición no existe dentro del Top ${topLimits.limit} <:ani_chibiqiqipeek:1244839483581403138>`)
        return await interaction.editReply(`Tu posición actual es **${user.position}** <:steamunga:1298001230790135939>`)
    } catch (error) {
        logger.ERR(error)
        try {
            await interaction.editReply({ 
                content: 'Ups! Ha ocurrido un error. Intenta mas tarde... <:birthday2:1249345278566465617>' 
            })
        } catch (e) {
            
        }
    }
}

module.exports = {
	leave,
	join,
	position
}