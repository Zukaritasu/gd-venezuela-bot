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

const logger = require("../../logger")
const topLimits = require("../../../.botconfig/top-limits.json")
const { COLL_TEXT_XP } = require('../../../.botconfig/database-info.json');
const { Db } = require("mongodb");
const { ChatInputCommandInteraction, GuildMember, MessageFlags } = require("discord.js");
const activity = require("../leveling/activity");
const activityFrame = require("./activity-frame");
const topxpBacklist = require('../text-commands/topxp-blacklist')

/////////////////////////////////////////

/**
 * @typedef {Object} UserInfo
 * @property {string} id
 * @property {number} position
 * @property {number} xp
 * @property {boolean} assigned
 */

/**
 * @param {Db} db 
 * @param {ChatInputCommandInteraction} interaction 
 * @returns {Promise<{ position: number } | null>}
 */
async function getUserInfo(db, interaction) {
    const userActivity = await activity.getUserActivityData(db, interaction)
    if (userActivity === null)
        return null;

    return { 
        position: userActivity.position === 1 && userActivity.points === 0 ? 0 : userActivity.position, 
        voicePosition: userActivity.voicePosition === 1 && userActivity.voicePoints === 0 ? 0 : userActivity.voicePosition,
    }
}

/**
 * Add or remove user from blacklist
 * 
 * @param {Db} database 
 * @param {string} id 
 * @param {boolean} add
 */
async function addOrRemoveUser(database, id, add) {
    const blacklistCollection = database.collection(COLL_TEXT_XP);
    
    const result = await blacklistCollection.updateOne(
        { type: 'blacklist' },
        add ? { $addToSet: { blacklist: id } } : { $pull: { blacklist: id } },
        { upsert: true }
    );

    if (!result.acknowledged) {
        throw new Error(`Failed to ${add ? 'add' : 'remove'} user ${id} ${add ? 'to' : 'from'} blacklist.`);
    }
}

/**
 * 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function leave(database, interaction) {
    try {
        if (!interaction.guild || !interaction.member) return
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        /** @type {GuildMember} */
        const member = interaction.member
        const userInfo = await getUserInfo(database, member)

        if (userInfo.position === 0 || userInfo.position > topLimits.limit) {
            return await interaction.editReply(`Tu posición no existe dentro del Top ${topLimits.limit} <:ani_chibiqiqipeek:1244839483581403138>`)
        }

        if (!member.roles.cache.has(topLimits.starsRoleID)) {
            return await interaction.editReply(`No tienes asignado el rol Estrellas`)
        }

        await member.roles.remove(topLimits.starsRoleID, `The user unsubscribed with the Estrellas role`)
        await addOrRemoveUser(database, member.id, true)
        await interaction.editReply(`Se ha procesado la solicitud con éxito! Tu rol de Estrellas ha sido removido.`)
    } catch (error) {
        logger.ERR(error)
        try {
            await interaction.editReply({
                content: 'Ha ocurrido un error. Intenta mas tarde...'
            })
        } catch (replyError) {
            logger.ERR(replyError)
        }
    }
}

/**
 * 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function join(database, interaction) {
    try {
        if (!interaction.guild || !interaction.member) return
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const exits = await database.collection(COLL_TEXT_XP).findOne(
            {
                type: 'blacklist',
                blacklist: interaction.member.id
            });

        if (!exits) {
            return await interaction.editReply(`Usuario no encontrado en la lista de exclusión`)
        }

        await addOrRemoveUser(database, interaction.member.id, false)
        await interaction.editReply(`Se ha procesado la solicitud con éxito! Tu rol se asignará en la proxima actualización del Top ${topLimits.limit}`)
    } catch (error) {
        logger.ERR(error)
        try {
            await interaction.editReply({
                content: 'Ha ocurrido un error. Intenta mas tarde...'
            })
        } catch (replyError) {
            logger.ERR(replyError)
        }
    }
}

/**
 * 
 * @param {Db} db 
 * @param {ChatInputCommandInteraction} interaction 
 * @returns 
 */
async function position(db, interaction) {
    try {
        if (!interaction.guild || !interaction.member) return
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const typeBoard = interaction.options.getString('tipo') || 'text';
        const userInfo = await getUserInfo(db, interaction)
        if (!userInfo)
            return await interaction.editReply(`Aún no tienes XP. Si crees que fue un error, vuelve a intentarlo pasados 15 minutos <:ani_chibiqiqipeek:1244839483581403138>`)
        return await interaction.editReply(`Tu posición actual es **#${typeBoard === 'voice' ? userInfo.voicePosition : userInfo.position}** <:steamunga:1326787243490148442>`)
    } catch (error) {
        logger.ERR(error)
        try {
            await interaction.editReply({
                content: 'Ups! Ha ocurrido un error. Intenta mas tarde... <:birthday2:1249345278566465617>'
            })
        } catch {

        }
    }
}

async function memberActivity(db, interaction) {
    try {
        if (!interaction.guild || !interaction.member) return
        
        await interaction.deferReply()

        const user = interaction.options.getUser('usuario') || interaction.user
        const member = await interaction.guild.members.fetch(user.id).catch(() => null)
        if (!member) {
            return await interaction.editReply(`No se pudo encontrar al usuario en el servidor.`)
        }

        const attachment = await activityFrame.getActivityFrame(db, { user })
        await interaction.editReply({
            files: [attachment]
        })
    } catch (error) {
        logger.ERR(error)
        try {
            await interaction.editReply({
                content: 'Ups! Ha ocurrido un error. Intenta mas tarde... <:birthday2:1249345278566465617>'
            })
        } catch {
            
        }
    }
}

module.exports = {
    leave,
    join,
    position,
    memberActivity
}