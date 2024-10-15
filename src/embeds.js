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

const { EmbedBuilder, ChatInputCommandInteraction, Client, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle } = require('discord.js');
const { states } = require('../.botconfig/country-states.json')
const https = require('https');
const utils = require('./utils');

const EMBED_COLOR = 0x2b2d31 /** Black */


/**
 * @param {Client} client 
 * @param {ChatInputCommandInteraction} interaction 
 * @returns 
 */
async function embedNumberPlayers(_client, _database, interaction) {
    const guild = interaction.guild;
    let fields = [];

    for (const state of states) {
        const role = guild.roles.cache.get(state.roleId);
        if (role !== undefined) {
            fields.push({ name: state.name, value: `${role.members.size}`, inline: true })
        } else {
            fields.push({ name: state.name, value: `unknown`, inline: true })
        }
    }

    let embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle('Cantidad de Jugadores por Estado')
        .addFields(fields)
        .setTimestamp()
        .setFooter({ text: `GD Venezuela` })
        .setThumbnail('https://flagcdn.com/256x192/ve.png');
    return embed;
}

/**
 * 
 * @param {Number} level 
 * @returns Object
 */
function getResponseJSON(id) {
    return new Promise(function (resolve, reject) {
        https.get(`https://www.pointercrate.com/api/v2/demons/${id}`, res => {
            let data = [];
            res.on('data', chunk => { data.push(chunk); });
            res.on('end', () => { resolve(JSON.parse(Buffer.concat(data).toString()).data) });
            res.on('error', err => { reject(err); })
        });
    });
}

/**
 * 
 * @param {*} _client 
 * @param {*} database 
 * @param {ChatInputCommandInteraction} interaction 
 * @returns 
 */
async function embedHardest(_client, database, interaction) {
    let hardest = await database.collection('config').findOne({ type: 'hardest' })
    if (hardest === null) {
        return { content: 'Aun no se ha definido un hardest' };
    } else {
        const levelInfo = await getResponseJSON(hardest.levelId)
        if (levelInfo instanceof Error) {
            return { content: 'Ha ocurrido un error al consultar la informacion del nivel' };
        }

        let embed = new EmbedBuilder()
        embed.setColor(EMBED_COLOR)
        embed.setTitle(`${levelInfo.name} (Top #${levelInfo.position})`)
        embed.addFields(
            { name: 'Usuario', value: `<:cn:1295174767317618748> <@${hardest.memberId}>`, inline: true },
            //{ name: 'Usuario de Pointercrate', value: `${hardest.username}`, inline: true },
            { name: 'Hardest del Estado', value: `${hardest.stateName}`, inline: true }
        )
        embed.setTimestamp()
        embed.setFooter({ text: `GD Venezuela` })
        embed.setImage(await utils.getYouTubeThumbnail(hardest.videoUrl));

        const member = interaction.guild.members.cache.get(`${hardest.memberId}`)
        if (!member) {
            embed.setThumbnail('https://cdn.discordapp.com/attachments/1041060604850483404/1294740130422063189/Epic_Extreme_Demon.png')
        } else {
            const user = member.user
            const userAvatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            embed.setThumbnail(userAvatar)
            embed.setAuthor({
                name: user.globalName ? user.globalName : user.username,
                iconURL: userAvatar
            })
        }

        const row = new ActionRowBuilder()

        const vBtn = new ButtonBuilder()
        vBtn.setLabel('Ver Video')
        vBtn.setURL(hardest.videoUrl)
        vBtn.setStyle(ButtonStyle.Link)

        const pBtn = new ButtonBuilder()
        pBtn.setLabel('Pointercrate')
        pBtn.setURL(`https://www.pointercrate.com/demonlist/${levelInfo.position}`)
        pBtn.setStyle(ButtonStyle.Link)

        row.addComponents(vBtn, pBtn);

        return { embeds: [embed], components: [row] }
    }
}

module.exports = {
    embedNumberPlayers,
    embedHardest
}