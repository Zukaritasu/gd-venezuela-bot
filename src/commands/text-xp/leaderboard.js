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

const { ChatInputCommandInteraction, EmbedBuilder, Message, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")
const { Db } = require("mongodb")
const logger = require('../../logger')
const activity = require("../leveling/activity")
const topLimits = require('../../../.botconfig/top-limits.json')

/**
 * Generates an Embed with the top users based on their XP/Points.
 * 
 * @param {Db} database MongoDB database instance.
 * @param {ChatInputCommandInteraction | Message} interaction The Discord interaction or message that triggered the command.
 * @param {number} page The page number to display.
 * @param {string} type The type of leaderboard to generate ('text', 'voice', etc.).
 * @returns {Promise<{embed: EmbedBuilder, totalPages: number}>} An object containing the Embed and the total number of pages.
 */
async function getTopXPEmbed(database, interaction, page, type = 'text') {
    const limit = 15
    const data = await activity.getTopUsersData(database, page, type, limit);

    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(`TOP XP ${ type === 'voice' ? 'VOZ' : 'TEXT' }`)
        .setFooter({ text: `Page ${page} / ${data.totalPages || 1}` })
        .setTimestamp();

    const padEnd = (text, len) => text.toString().padEnd(len, ' ');
    const padStart = (text, len) => text.toString().padStart(len, ' ');

    let table = '```\n';
    let position = (page - 1) * limit + 1;

    for (let i = 0; i < data.users.length; i++) {
        const user = data.users[i];

        // Sanitization to prevent markdown injection (especially backticks)
        const name = (user.userName || '<Unknown>').replace(/`/g, '´').substring(0, 15);
        const pts = user.points?.toLocaleString() || '0';
        const isMe = user.userId === interaction.user.id ? '»' : ' ';

        table += `${isMe}${padStart(position++, 2)} | ${padEnd(name, 15)} | ${padEnd(pts, 8)}\n`;
    }

    table += '```';

    embed.setDescription(table);
    return { embed, totalPages: data.totalPages };
}

/**
 * Creates the button row for leaderboard navigation.
 * 
 * @param {number} page Current page.
 * @param {number} totalPages Total available pages.
 * @returns {ActionRowBuilder} An action row with navigation buttons.
 */
function createButtonRow(page, totalPages) {
    const row = new ActionRowBuilder()

    const prev = new ButtonBuilder()
    prev.setCustomId('prev')
    prev.setEmoji('<:retroceder:1436857028092887091>')
    prev.setStyle(ButtonStyle.Secondary)
    prev.setDisabled(totalPages <= 1 || page === 1)

    const next = new ButtonBuilder()
    next.setCustomId('next')
    next.setEmoji('<:siguiente:1436857026876538900>')
    next.setStyle(ButtonStyle.Secondary)
    next.setDisabled(totalPages <= 1 || page === totalPages)

    const close = new ButtonBuilder()
    close.setCustomId('close')
    close.setEmoji('<:close:1320737181358227551>')
    close.setStyle(ButtonStyle.Danger)
    close.setDisabled(totalPages == -1)

    row.addComponents(prev, next, close)    

    return row
}

/**
 * Main entry point to execute the leaderboard command.
 * Handles the initial response, component collector, and pagination logic.
 * 
 * @param {Db} database Database instance.
 * @param {ChatInputCommandInteraction} interaction The Discord command interaction.
 */
async function execute(database, interaction) {
    try {
        await interaction.deferReply()

        // Input validation: Ensure page is at least 1
        let page = Math.max(1, interaction.options.getNumber('pagina') ?? 1)

        const typeBoard = interaction.options.getString('tipo') || 'text';

        const { embed, totalPages } = await getTopXPEmbed(database, interaction, page, typeBoard)
        if (!embed)
            return await interaction.editReply('The user list is unavailable <:ani_okitathinking:1244840221376512021>')

        const row = createButtonRow(page, totalPages)
        await interaction.editReply({ embeds: [embed], components: [row] })

        // Filter so only the command author can interact with buttons
        const filter = i => i.user.id === interaction.user.id
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 }) // 5 minutes timeout

        collector.on('collect', async i => {
            if (i.customId === 'prev') {
                if (page > 1) page--;
            } else if (i.customId === 'next') {
                if (page < totalPages) page++;
            } else if (i.customId === 'close') {
                await i.message.delete();
                collector.stop();
                return;
            }

            const { embed: newEmbed } = await getTopXPEmbed(database, interaction, page, typeBoard)
            const newRow = createButtonRow(page, totalPages)
            await i.update({ embeds: [newEmbed], components: [newRow] })
        })

        collector.on('end', async () => {
            try {
                // Clear buttons when collector expires
                await interaction.editReply({ components: [createButtonRow(0, -1)] })
            } catch (e) {
                // Ignore errors if message was deleted
            }
        })
    } catch (error) {
        logger.ERR(error);
        try {
            await interaction.editReply({
                content: 'Oops! An error occurred. Please try again later... <:birthday2:1249345278566465617>'
            })
        } catch (e) {
            // Ignore errors when failing gracefully
        }
    }
}

module.exports = {
    execute
}