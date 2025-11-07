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
const { states } = require('../../../.botconfig/country-states.json')
const logger = require('../../logger');

///////////////////////////////////////////

/**
 * @param {Client} client 
 * @param {ChatInputCommandInteraction} interaction 
 * @returns 
 */
async function embedNumberPlayers(_client, _database, interaction) {
    let fields = [];

    for (const state of states) {
        const role = interaction.guild.roles.cache.get(state.roleId);
        if (role !== undefined) {
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
        content: '',
        embeds: [
            new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle('CANTIDAD DE JUGADORES POR ESTADO')
                .addFields(fields)
                .setTimestamp()
                .setFooter({ text: `GD Venezuela` })
                //.setThumbnail('https://flagcdn.com/256x192/ve.png')
                .setAuthor({
                    name: 'Venezuela',
                    iconURL: 'https://flagcdn.com/w640/ve.png'
                })
        ],
        components: []
    };
}

/**
 * 
 * @param {*} _client 
 * @param {*} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(client, database, interaction) {
    try {
        await interaction.deferReply();
        await interaction.editReply(await embedNumberPlayers(client, database, interaction));
    } catch (e) {
        logger.ERR(e);
        await interaction.editReply(
            {
                content: 'An unknown error has occurred',
                embeds: [],
                components: []
            }
        );
    }
}

module.exports = {
    execute
};
