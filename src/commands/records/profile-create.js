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

const { Client, ChatInputCommandInteraction } = require("discord.js");
const { Db } = require("mongodb");
const logger = require("../../logger");
const utils = require("../../utils");
const { states } = require('../../../.botconfig/country-states.json');
const { COLL_GDVZLA_LIST_PROFILES } = require('../../../.botconfig/database-info.json');

/**
 * 
 * @param {Client} _client 
 * @param {Db} db
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, db, interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('user');
        if (user.bot) {
            return await interaction.editReply({
                content: 'No puedes crear un perfil para un bot.'
            });
        }

        let member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            try {
                member = await interaction.guild.members.fetch(user.id);
            } catch (error) {
                return await interaction.editReply({
                    content: 'El usuario no está en el servidor.'
                });
            }
        }

        if (!member.roles || !member.roles.cache.has('1119804850620866600')) {
            return await interaction.editReply({
                content: 'El usuario debe ser Venezolano para crear un perfil.'
            });
        }

        if (interaction.user.id !== member.user.id && !utils.hasUserPermissions(interaction.member)) {
            return await interaction.editReply({
                content: 'No tienes permiso para crear un perfil para otro usuario.'
            });
        }

        let stateName = null;
        const length = member.roles.cache.size;
        for (let i = 0; i < length; i++) {
            const role = member.roles.cache.at(i);
            if (role) {
                const state = states.find(state => state.roleId === role.id);
                if (state) {
                    stateName = state.flagUrl.substring(state.flagUrl.lastIndexOf('/') + 1, state.flagUrl.lastIndexOf('.'));
                    break;
                }
            }
        }

        if (!stateName) {
            return await interaction.editReply({
                content: interaction.user.id === member.user.id ? 'No tienes un rol de Estado asignado. Puedes pedir uno en el canal <#1216237948664549426>' : 
                    'El usuario no tiene un rol de Estado asignado. Pídele que lo solicite en el canal <#1216237948664549426> o asignalo tú mismo si tienes permisos.'
            });
        }

        const username = interaction.options.getString('username');
        const result = await db.collection(COLL_GDVZLA_LIST_PROFILES).findOne({ userId: user.id })
        if (result) {
            return await interaction.editReply({
                content: `El perfil del usuario ya existe.`
            });
        }

        const profile =
        {
            userId: user.id,
            username: username,
            state: stateName,
        };

        const insertResult = await db.collection(COLL_GDVZLA_LIST_PROFILES).insertOne(profile);
        if (!insertResult.acknowledged || !insertResult.insertedId) {
            return await interaction.editReply({
                content: 'No se pudo crear el perfil. Por favor, inténtalo de nuevo más tarde.'
            });
        }

        return await interaction.editReply({
            content: `Perfil **${username}** creado exitosamente!`
        });

    } catch (error) {
        logger.ERR(error);
        try {
            return await interaction.editReply({
                content: 'Ocurrió un error al crear el perfil. Por favor, inténtalo de nuevo más tarde.'
            });
        } catch {
            
        }
    }
}

module.exports = {
    execute
}