/**
 * Copyright (C) 2024 - 2026 Zukaritasu
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

const { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Client } = require('discord.js');
const { states } = require('../../../.botconfig/country-states.json')
const { Db } = require('mongodb');
const logger = require('../../logger');

/**
 * @param {ChatInputCommandInteraction} interaction 
 * @returns 
 */
async function embedNumberPlayers(interaction) {
    let fields = [];

    try {
        await interaction.guild.members.fetch({ force: true });
    } catch (e) {
        // Fallback to cached member counts if fetching all members fails
    }

    for (const state of states) {
        const role = interaction.guild.roles.cache.get(state.roleId);
        if (role) {
            fields.push(
                {
                    name: state.name,
                    value: `${role.members.size}`,
                    inline: true
                }
            )
        } else {
            fields.push(
                {
                    name: state.name,
                    value: `unknown`,
                    inline: true
                }
            )
        }
    }

    fields.sort((a, b) => {
        const aValue = a.value === 'unknown' ? 0 : parseInt(a.value, 10);
        const bValue = b.value === 'unknown' ? 0 : parseInt(b.value, 10);
        return bValue - aValue;
    });

    return {
        embeds: [
            new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle('CANTIDAD DE JUGADORES POR ESTADO')
                .addFields(fields)
                .setTimestamp()
                .setFooter({ text: `GD Venezuela` })
                .setAuthor({
                    name: 'Venezuela',
                    iconURL: 'https://flagcdn.com/w640/ve.png'
                })
        ]
    };
}

/**
 * 
 * @param {Client} _client 
 * @param {Db} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, _database, interaction) {
    try {
        await interaction.deferReply();
        await interaction.editReply(await embedNumberPlayers(interaction));
    } catch (e) {
        logger.ERR(e);
        try {
            interaction.deferred ? await interaction.editReply('An unknown error has occurred') :
                await interaction.reply('An unknown error has occurred')
        } catch {

        }
    }
}

module.exports = {
    execute
};
