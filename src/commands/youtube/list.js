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

const { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Component, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../../logger');
const utils = require('../../utils');

const MAX_FIELDS = 6; // Max fields per embed
const ERROR_TIMEOUT_MESSAGE = 'Collector received no interactions before ending with reason: time'

async function getEmbedFields(channels, begin) {
    const fields = [];
    for (let i = begin; i < channels.length && i < begin + MAX_FIELDS; i++) {
        fields.push({
            name: channels[i].username,
            value: `- <@&${channels[i].mentionRoleId}> - [YouTube Canal](https://youtube.com/channel/${channels[i].channelId})\n- Descripción: ${utils.escapeDiscordSpecialChars(channels[i].description)}`
        });
    }

    const embed = new EmbedBuilder()
    embed.setTitle('Canales de YouTube Registrados')
    embed.setColor(0x2b2d31)
    embed.setTimestamp();
    embed.setFooter({ text: `GD Venezuela` })
    embed.setAuthor({
        name: 'Venezuela',
        iconURL: 'https://flagcdn.com/w640/ve.png'
    })


    embed.addFields(...fields);

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setEmoji('<:retroceder:1320736997941317715>')
                    .setCustomId('previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(begin === 0),
                new ButtonBuilder()
                    .setEmoji('<:siguiente:1320749783505178725>')
                    .setCustomId('next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(begin + MAX_FIELDS >= channels.length),
                new ButtonBuilder()
                    .setEmoji('<:close:1320737181358227551>')
                    .setCustomId('close')
                    .setStyle(ButtonStyle.Danger)
            )
        ]
    };
}

/**
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 * @returns 
 */
async function execute(database, interaction) {
    try {
        const channels = await database.collection('youtube_channels').find().toArray();
        if (channels.length === 0) {
            await interaction.reply({
                content: 'No hay canales registrados.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply();

        let begin = 0, confirmation = interaction, message = null;
        const collectorFilter = i => i.user.id === interaction.user.id;

        try {
            while (true) {
                const funcReply = confirmation instanceof ChatInputCommandInteraction ? interaction.editReply.bind(interaction) : 
                    confirmation.update.bind(confirmation)
                confirmation = await (await funcReply(message = await getEmbedFields(channels, begin)))
                    .awaitMessageComponent(
                        {
                            filter: collectorFilter,
                            time: 120000 // 2 minutes
                        }
                    )

                if (confirmation.customId === 'previous') {
                    begin -= MAX_FIELDS
                } else if (confirmation.customId === 'next') {
                    begin += MAX_FIELDS
                } else { // close
                    await interaction.deleteReply(); break
                }
            }
        } catch (error) {
            try {
                if (error.message !== ERROR_TIMEOUT_MESSAGE) {
                    logger.ERR(error)
                    await interaction.editReply({
                        content: 'Ocurrió un error al ejecutar el comando.',
                        ephemeral: true
                    });
                } else {
                    if (message) {
                        message.components.at(0).components.forEach(button => button.setDisabled(true))
                        await interaction.editReply(message)
                    }
                }
            } catch (err) {
                logger.ERR(err)
            }
        }
    } catch (error) {
        logger.ERR(error);
        await interaction.reply({
            content: 'Ocurrió un error al ejecutar el comando.',
            ephemeral: true
        });
    }
}

module.exports = {
    execute
};