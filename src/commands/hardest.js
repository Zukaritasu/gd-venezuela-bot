/**
 * Copyright (C) 2024 - 2026 Zukaritasu
 * 
 * This program is free software: you can redistribute it and/or modify
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
const aredlapi = require('../apis/aredlapi');
const logger = require('../logger');
const { Db } = require('mongodb');
const { COLL_CONFIG } = require('../../.botconfig/database-info.json')

/**
 * Creates an embed displaying information about the hardest level.
 * 
 * @param {import('./staff/set-hardest').CountryHardest} hardest - The hardest level record 
 * from the database.
 * @param {Db} database - The MongoDB database instance.
 * @param {ChatInputCommandInteraction} interaction - The interaction that triggered the command.
 * @returns {Promise<{embeds: EmbedBuilder[], components: ActionRowBuilder[]}|string>} - A promise 
 * resolving to the created embed or an error message.
 */
async function createEmbed(hardest, database, interaction) {
    const level = await aredlapi.getLevel(hardest.levelId)
    if (level instanceof Error) {
        logger.ERR(level)
        return 'Ha ocurrido un error al consultar la informacion del nivel'
    }

    const attemps = hardest?.toString()?.replace(/\B(?=(\d{3})+(?!\d))/g, ".") || '0'

    const embed = new EmbedBuilder()
    embed.setColor(0x2b2d31)
    embed.setTitle(`${level.name} (Top #${level.position})`)
    embed.addFields(
        { name: 'Usuario', value: `<:cn:1295174767317618748> <@${hardest.memberId}>`, inline: true },
        { name: 'Hardest del Estado', value: `${hardest.stateName}`, inline: true },
        { name: 'Intentos', value: `${attemps}`, inline: true }
    )
    embed.setTimestamp()
    embed.setFooter({ text: `GD Venezuela` })
    embed.setImage(await utils.getYouTubeThumbnail(hardest.videoUrl));

    const member = interaction.guild.members.cache.get(hardest.memberId)
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
                    .setURL(`https://www.pointercrate.com/demonlist/${level.position}`)
                    .setStyle(ButtonStyle.Link)
            )]
    }
}

/**
 * Fetches and normalizes the hardest level information for a specific
 * country state role assigned to a user.
 * 
 * @param {Client} _client - The Discord client instance.
 * @param {Db} database - The MongoDB database instance.
 * @param {ChatInputCommandInteraction} interaction - The interaction object from Discord.js.
 */
async function execute(_client, database, interaction) {
    try {
        await interaction.deferReply();
        const hardest = await database.collection(COLL_CONFIG).findOne({ type: 'hardest' })
        await interaction.editReply(hardest == null
            ? 'Aun no se ha definido un hardest' :
            await createEmbed(hardest, database, interaction));
    } catch (e) {
        logger.ERR(e);
        try {
            await interaction.editReply('Ha ocurrido un error inesperado');
        } catch {

        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hardest')
        .setDescription('El nivel más difícil del país'),
    execute,
};
