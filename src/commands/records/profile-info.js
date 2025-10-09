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

const { Client, ChatInputCommandInteraction, Embed, EmbedBuilder } = require("discord.js");
const { Db } = require("mongodb");
const logger = require("../../logger");
const { COLL_GDVZLA_LIST_PROFILES } = require('../../../.botconfig/database-info.json')


/**
 * @param {Client} _client 
 * @param {Db} db
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, db, interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('user') || interaction.user;
        if (user.bot) {
            return await interaction.editReply({
                content: 'No puedes ver el perfil de un bot.'
            });
        }

        const profile = await db.collection(COLL_GDVZLA_LIST_PROFILES).findOne({ userId: user.id });
        if (!profile) {
            return await interaction.editReply({
                content: 'El usuario no tiene un perfil creado. Puedes crear uno con el comando `/records perfil crear`.'
            });
        }

        const member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            return await interaction.editReply({
                content: 'El usuario no está en el servidor.'
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setDescription(`Información del perfil de ${member.user.username}`)
            .addFields(
                { name: 'ID de Usuario', value: profile.userId, inline: true },
                { name: 'Nombre de Usuario', value: profile.username, inline: true },
                { name: 'Estado', value: profile.state, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Perfil de Records' });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.ERR(error)
        try {
            await interaction.editReply({
                content: 'Ocurrió un error al intentar obtener el perfil.'
            });
        } catch  {
            
        }
    }
}

module.exports = {
    execute
}