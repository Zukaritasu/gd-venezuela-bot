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

const { ChatInputCommandInteraction, EmbedBuilder, Message, ActionRowBuilder, ButtonStyle, ButtonBuilder } = require("discord.js")
const { Db } = require("mongodb")
const logger = require('../../logger');
const apipcrate = require('../../apipcrate');
const fs = require('fs');

/**
     * - Todos los Jugadores
     * - Jugadores activos
     * - Jugadores no activos
     * - Jugadores baneados
     * 
     * - Niveles completados
     *   > bloodlust: completado por jaeger, etc...
     * 
     * - Niveles
     *   > Mas dificil (en base a la posicion mas baja del 1 hacia el mas alto)
     *   > Mas facil (en base a la posicion mas baja alta)
     *   > Mas veces completado (pueden ser mas)
     * 
     * - Jugadores
     *   > jugador con mas niveles completados (pueden ser mas usuarios)
     *   > jugador con menos niveles completados (pueden ser mas usuarios)
     *   > jugador con el nivel mas dificil completado (en base a la posicion mas baja del 1 hacia el mas alto)
     */

async function getInfo() {
    const response = await apipcrate.getCountryLeaderboard('VE');
    if (response instanceof Error) {
        throw response;
    }

    const struct = {
        levelsCompleted: [],
        allUsers: []
    };

    for (let i = 0; i < response.length; i++) {
        const playerInfo = await apipcrate.getPlayerExtraInfo(response[i].id);
        if (playerInfo instanceof Error) {
            throw playerInfo;
        }

        struct.allUsers.push({
            name: playerInfo.name,
            active: playerInfo.score > 0,
            banned: playerInfo.banned,
            id: playerInfo.id,
            score: playerInfo.score,
            rank: playerInfo.rank
        });

        playerInfo.records.forEach(record => {
            if (record.progress === 100) {
                let level = struct.levelsCompleted.find(level => level.name === record.demon.name);
                if (!level) {
                    level = {
                        name: record.demon.name,
                        position: record.demon.position,
                        completedBy: []
                    };
                    struct.levelsCompleted.push(level);
                }
                level.completedBy.push({
                    name: playerInfo.name,
                    id: playerInfo.id
                });
            }
        });
    }

    const info = {
        allPlayers: struct.allUsers.map(user => user.name),
        activePlayers: struct.allUsers.filter(user => user.active).map(user => user.name),
        inactivePlayers: struct.allUsers.filter(user => !user.active).map(user => user.name),
        bannedPlayers: struct.allUsers.filter(user => user.banned).map(user => user.name),
        levelsCompleted: {},
        mostDifficultLevel: null,
        easiestLevel: null,
        mostCompletedLevel: null,
        playersWithMostCompletedLevels: [],
        playersWithLeastCompletedLevels: [],
        playersWithMostDifficultLevel: [],
        playersWithHighestScores: [],
        playersWithLowestScores: []
    };

    struct.levelsCompleted.forEach(level => {
        info.levelsCompleted[level.name] = level.completedBy.map(player => player.name);
    });

    const sortedLevels = struct.levelsCompleted.sort((a, b) => a.position - b.position);
    info.mostDifficultLevel = sortedLevels[0];
    info.easiestLevel = sortedLevels[sortedLevels.length - 1];

    const levelCompletionCounts = struct.levelsCompleted.map(level => ({
        name: level.name,
        count: level.completedBy.length
    })).sort((a, b) => b.count - a.count);

    info.mostCompletedLevel = levelCompletionCounts.filter(level => level.count === levelCompletionCounts[0].count);

    const playerCompletionCounts = {};

    struct.levelsCompleted.forEach(level => {
        level.completedBy.forEach(player => {
            if (!playerCompletionCounts[player.name]) {
                playerCompletionCounts[player.name] = 0;
            }
            playerCompletionCounts[player.name]++;
        });
    });

    const maxCompleted = Math.max(...Object.values(playerCompletionCounts));
    const minCompleted = Math.min(...Object.values(playerCompletionCounts));

    info.playersWithMostCompletedLevels = Object.keys(playerCompletionCounts).filter(player => playerCompletionCounts[player] === maxCompleted);
    info.playersWithLeastCompletedLevels = Object.keys(playerCompletionCounts).filter(player => playerCompletionCounts[player] === minCompleted);

    const mostDifficultLevelPosition = info.mostDifficultLevel.position;
    info.playersWithMostDifficultLevel = struct.levelsCompleted
        .filter(level => level.position === mostDifficultLevelPosition)
        .flatMap(level => level.completedBy.map(player => player.name));

    const sortedByScore = struct.allUsers.sort((a, b) => b.score - a.score);
    info.playersWithHighestScores = sortedByScore.filter(user => user.score === sortedByScore[0].score).map(user => user.name);
    info.playersWithLowestScores = sortedByScore.filter(user => user.score === sortedByScore[sortedByScore.length - 1].score).map(user => user.name);

    return info;
}

/**
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(database, interaction) {
    try {
        await interaction.reply({
            content: 'Selecciona una de las opciones para visualizar el archivo',
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Link)
                        .setLabel('Google Drive')
                        .setURL('https://drive.google.com/file/d/1x7dqrL5r3rFU9cLpBVm-krviY7H1VdpY/view?usp=sharing'),
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Link)
                        .setLabel('Descargar archivo')
                        .setURL('https://drive.usercontent.google.com/download?id=1x7dqrL5r3rFU9cLpBVm-krviY7H1VdpY')
                )
            ]
        })
    } catch (error) {
        logger.ERR(error)
        try {
            await interaction.reply({
                content: '¡Ups! Ha ocurrido un error. Intenta más tarde... <:birthday2:1249345278566465617>'
            })
        } catch (e) {
            logger.ERR(e)
        }
    }
}

module.exports = {
    execute
}