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

const { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder,
    ButtonBuilder, ButtonStyle,
    Client } = require('discord.js');

const apipcrate = require('../../../apipcrate');
const demonsTrophy = require('../../../../resources/demon_trophy.json');

/**
 * 
 * @param {Number} position 
 * @returns {string}
 */
function getDemonIconByPosition(position) {
    for (let i = 0; i < demonsTrophy.length; i++) {
        if (position <= demonsTrophy[i].top) {
            return demonsTrophy[i].emoji
        }
    }

    return demonsTrophy[demonsTrophy.length - 1].emoji
}

/**
 * 
 * @param {Array<Object>} records 
 */
function getDemonsInfo(records) {
    let demonsInfo = {
        hardest: {
            position: 32767,
            name: ''
        },
        main: {
            count: 0,
            demons: []
        },
        extended: {
            count: 0,
            demons: []
        },
        legacy: {
            count: 0,
            demons: []
        },
        progress: {
            count: 0,
            demons: []
        }
    }

    records.forEach(record => {
        if (record.progress === 100 && record.demon.position < demonsInfo.hardest.position) {
            demonsInfo.hardest = {
                position: record.demon.position,
                name: record.demon.name
            }
        }

        const position = record.demon.position;

        if (record.progress < 100) {
            demonsInfo.progress.count++;
            demonsInfo.progress.demons.push(record)
        } else if (position <= 75) {
            demonsInfo.main.count++;
            demonsInfo.main.demons.push(record)
        } else if (position <= 150) {
            demonsInfo.extended.count++;
            demonsInfo.extended.demons.push(record)
        } else {
            demonsInfo.legacy.count++;
            demonsInfo.legacy.demons.push(record)
        }
    });

    return demonsInfo;
}

/**
 * 
 * @param {*} client 
 * @param {*} database 
 * @param {*} interaction 
 * @param {*} playerId 
 * @returns 
 */
async function createEmbedProfile(client, database, interaction, playerId /* demonlist */) {
    try {
        const playerInfo = await apipcrate.getPlayerExtraInfo(playerId)
        if (playerInfo instanceof Error) {
            console.error(playerInfo)
            return null
        }

        const embed = new EmbedBuilder()
        embed.setColor(0x2b2d31)
        embed.setTitle(playerInfo.name)
        embed.setFooter({ text: `GD Venezuela` })
        embed.setThumbnail('https://cdn.discordapp.com/icons/395654171422097420/379cfde8752cedae26b7ea171188953c.png')
        embed.setTimestamp()

        embed.setAuthor({
            name: 'Venezuela',
            iconURL: 'https://flagcdn.com/w640/ve.png'
        })

        const demonsInfo = getDemonsInfo(playerInfo.records) 

        embed.addFields(
            {
                name: 'Demonlist rank',
                value: playerInfo.rank === undefined ? 'None' : `${playerInfo.rank} ${getDemonIconByPosition(playerInfo.rank)}`,
                inline: true
            },
            {
                name: 'Demonlist score',
                value: `${playerInfo.score.toFixed(2)}`,
                inline: true
            },
            {
                name: 'Demonlist stats',
                value: `${demonsInfo.main.count} Main, ${demonsInfo.extended.count} Extended, ${demonsInfo.legacy.count} Legacy`,
                inline: true
            },
            {
                name: 'Hardest demon',
                value: `**${demonsInfo.hardest.name} (Top #${demonsInfo.hardest.position})**`,
                inline: true
            },
            {
                name: 'Main demons',
                value: `${demonsInfo.main.count === 0 ? 'None' : demonsInfo.main.demons.map(record => `${record.demon.name}`).join(' - ')}`
            },
            {
                name: 'Extended demons',
                value: `${demonsInfo.extended.count === 0 ? 'None' : demonsInfo.extended.demons.map(record => `${record.demon.name}`).join(' - ')}`
            },
            {
                name: 'Legacy demons',
                value: `${demonsInfo.legacy.count === 0 ? 'None' : demonsInfo.legacy.demons.map(record => `${record.demon.name}`).join(' - ')}`
            },
            {
                name: 'Demons created',
                value: `${playerInfo.created.length === 0 ? 'None' : playerInfo.created.map(level => `${level.name}`).join(' - ')}`
            },
            {
                name: 'Demons published',
                value: `${playerInfo.published.length === 0 ? 'None' : playerInfo.published.map(level => `${level.name}`).join(' - ')}`
            },
            {
                name: 'Demons verified',
                value: `${playerInfo.verified.length === 0 ? 'None' : playerInfo.verified.map(level => `${level.name}`).join(' - ')}`
            },
            {
                name: 'Progress on',
                value: `${demonsInfo.progress.demons.length === 0 ? 'None' : demonsInfo.progress.demons.map(record => `${record.demon.name} (${record.progress}%)`).join(' - ')}`
            }
        )

        return embed
    } catch (error) {
        console.error(error)
    }

    return null
}

module.exports = {
    createEmbedProfile
}