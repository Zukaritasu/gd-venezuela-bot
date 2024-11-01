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
const utils = require('../utils');
const apipcrate = require('../apipcrate');
const { Db } = require('mongodb');

const EMBED_COLOR = 0x2b2d31 /** Black */

//
//============================================================================
//

/**
 * 
 * @param {*} hardest 
 * @param {*} database 
 * @param {*} interaction 
 * @returns 
 */
async function createEmbed(hardest, database, interaction) {
    const response = await apipcrate.getDemon(hardest.levelId)
    if (response instanceof Error) {
        console.error(response)
        return { content: 'Ha ocurrido un error al consultar la informacion del nivel' };
    }

    const levelInfo = response.data

    let attemps = hardest.attemps ?? null
    if (attemps) {
        attemps = attemps.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    }

    let embed = new EmbedBuilder()
    embed.setColor(EMBED_COLOR)
    embed.setTitle(`${levelInfo.name} (Top #${levelInfo.position})`)
    embed.addFields(
        { name: 'Usuario', value: `<:cn:1295174767317618748> <@${hardest.memberId}>`, inline: true },
        { name: 'Hardest del Estado', value: `${hardest.stateName}`, inline: true },
        { name: 'Intentos', value: `${attemps ?? 'unknown'}`, inline: true }
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

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Ver Video')
                    .setURL(hardest.videoUrl)
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('Pointercrate')
                    .setURL(`https://www.pointercrate.com/demonlist/${levelInfo.position}`)
                    .setStyle(ButtonStyle.Link)
        )]
    }
}

/**
 * 
 * @param {Client} _client 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, database, interaction) {
    try {
        await interaction.deferReply();
        const hardest = await database.collection('config').findOne({ type: 'hardest' })
        if (hardest === null)
            await interaction.editReply('Aun no se ha definido un hardest');
        else
            await interaction.editReply(await createEmbed(hardest, database, interaction));
    } catch (error) {
        console.error(error);
        await interaction.editReply('Ha ocurrido un error desconocido');
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hardest')
        .setDescription('El nivel más difícil del país'),
    execute,
};
