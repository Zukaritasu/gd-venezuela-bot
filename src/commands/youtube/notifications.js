/**
 * Copyright (C) 2026 Zukaritasu
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

const { ChatInputCommandInteraction, GuildMember, MessageFlags, ModalSubmitInteraction, ActionRowBuilder, TextInputBuilder, ModalBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, LabelBuilder, ComponentType, CheckboxBuilder } = require("discord.js");
const { COLL_YOUTUBE_CHANNELS } = require('../../../.botconfig/database-info.json')
const { YOUTUBE_WEBHOOK_SECRET, YOUTUBE_NOTIFICATIONS_PORT } = require('../../../.botconfig/token.json')
const { Db } = require("mongodb");
const axios = require('axios')
const logger = require('../../logger')
const { PUBLIC_IP } = require('../../../.botconfig/token.json');
const utils = require("../../utils");
const { EmbedBuilder } = require("discord.js");

const WEBHOOK_URL = `http://${PUBLIC_IP}:${YOUTUBE_NOTIFICATIONS_PORT}/youtube-webhook`;

/**
 * @typedef {Object} YouTubeChannel
 * 
 * @property {string} userId
 * @property {string} channelName
 * @property {string} channelId
 * @property {string} commentNewVideo
 * @property {string} commentNewStream
 * @property {string[]} videoFilter
 * @property {boolean} isEnabled
 * @property {number} datetimeSub
 */

/**
 * @type {globalThis & { database: Db }}
 */
const globalRef = global;

/**
 * Subscribes or unsubscribes a YouTube channel to/from a Webhook using the PubSubHubbub protocol.
 * 
 * @param {string} webhookUrl - The callback URL where YouTube will send notifications.
 * @param {string} channelId - The unique ID of the YouTube channel.
 * @param {boolean} isSubscribe - True to subscribe and renew lease, false to unsubscribe.
 * @returns {Promise<boolean>} Resolves to true if the request was successful (status 204),
 * otherwise false.
 */
async function subscribeUnsubscribe(webhookUrl, channelId, isSubscribe) {
    const params = new URLSearchParams();
    params.append('hub.callback', webhookUrl);
    params.append('hub.topic', `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`);
    params.append('hub.mode', isSubscribe ? 'subscribe' : 'unsubscribe');

    if (isSubscribe) {
        params.append('hub.lease_seconds', '345600'); // 4 days
        params.append('hub.secret', YOUTUBE_WEBHOOK_SECRET);
    }

    try {
        const response = await axios.post('https://pubsubhubbub.appspot.com/subscribe', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.status === 202
    } catch (e) {
        logger.ERR(e)
    }

    return false
}

/**
 * Enables or disables YouTube webhook notifications for a user's channel.
 * 
 * This function defers the interaction, checks if the user has a registered channel,
 * toggles the subscription status via the PubSubHubbub protocol, and updates the 
 * database state accordingly.
 * 
 * @param {ChatInputCommandInteraction} interaction - The Discord slash command interaction object.
 * @param {boolean} isEnabled - The target state; true to enable notifications, false to disable.
 * @returns {Promise<Message | void>} A promise that resolves when the interaction reply is edited.
 */
async function setEnabled(interaction, isEnabled) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        /** @type {YouTubeChannel} */
        const channel = await globalRef.database.collection(COLL_YOUTUBE_CHANNELS).findOne({
            userId: interaction.user.id
        })

        if (!channel) {
            return await interaction.editReply({
                content: 'No tienes configurado un canal de YouTube en el bot'
            })
        }

        if (channel.isEnabled !== isEnabled) {
            const isSubscribeSuccessful = await subscribeUnsubscribe(
                WEBHOOK_URL,
                channel.channelId,
                isEnabled
            )

            if (!isSubscribeSuccessful) {
                await interaction.editReply({
                    content: 'No se ha podido ' + (isEnabled ? 'suscribir' : 'desuscribir')
                        + ' tu canal de YouTube. Revisa que el link de tu canal sea válido'
                })
            } else {
                await globalRef.database.collection(COLL_YOUTUBE_CHANNELS).updateOne(
                    { userId: interaction.user.id },
                    {
                        $set: {
                            isEnabled,
                            datetimeSub: isEnabled ? Date.now() : channel.datetimeSub
                        }
                    }
                )

                await interaction.editReply({
                    content: 'Actualizado con éxito!'
                })
            }
        } else {
            await interaction.editReply({
                content: 'El canal ya se encuentra ' + (isEnabled ? 'suscrito' : 'desuscrito')
            })
        }
    } catch (error) {
        try {
            logger.ERR(error)
            await interaction.editReply('Ha ocurrido un error desconocido. Inténtalo más tarde')
        } catch {

        }
    }
}

/**
 * Checks if a comment contains potentially dangerous or illegal Discord Markdown tags.
 * 
 * Specifically looks for:
 * - Global mentions (@everyone or @here)
 * - Raw Discord mentions/tags (users, roles, channels) excluding valid custom emojis
 * - Masked links/hyperlinks using Markdown syntax `[text](url)`
 * 
 * @param {string} comment - The raw text content to be validated.
 * @returns {boolean} True if any illegal tags or patterns are detected, otherwise false.
 */
function containsIllegalTags(comment) {
    const hasEveryoneOrHere = /@(everyone|here)\b/i.test(comment);
    const hasDiscordTags = /<(@|@&|#|\/)[^>]+>/.test(comment);
    const hasMaskedLinks = /\[[^\]]+\]\(\s*https?:\/\/[^\s)]+\)/i.test(comment);

    return hasEveryoneOrHere || hasDiscordTags || hasMaskedLinks;
}

/**
 * Configures or updates the YouTube channel subscription settings for a user.
 * 
 * Verifies authorization, validates provided command parameters (channel info and notification messages),
 * scans for illegal Markdown tags, processes subscription switches via PubSubHubbub if the channel URL 
 * changes, and persists the configuration using an upsert operation in the database.
 * 
 * @param {ChatInputCommandInteraction} interaction - The Discord slash command interaction object.
 * @returns {Promise<Message | void>} A promise that resolves when the command interaction finishes replying.
 */
async function configure(interaction) {
    try {
        /** @type {GuildMember} */
        const member = interaction.member;
        if (!member.roles.cache.find(role => role.id === process.env.ID_ROL_NOTABLE)) {
            return await interaction.reply({
                content: 'Usuario no autorizado',
                flags: MessageFlags.Ephemeral
            })
        }

        if (!('youtubeNotificationData' in interaction)) {
            throw new Error('Configuration data not found')
        }

        const channelName = interaction.youtubeNotificationData.channelName
        const channelId = interaction.youtubeNotificationData.channelId
        const commentNewVideo = interaction.youtubeNotificationData.commentNewVideo
        const commentNewStream = interaction.youtubeNotificationData.commentNewStream
        const videoFilter = interaction.youtubeNotificationData.videoFilter

        if (!channelName && !channelId && !commentNewVideo && !commentNewStream) {
            return await interaction.reply({
                content: 'Se requiere al menos un parámetro para continuar',
                flags: MessageFlags.Ephemeral
            })
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const isParametersCompleted = channelName && channelId && commentNewVideo && commentNewStream
        if (channelId && !/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
            return await interaction.editReply({
                content: 'El ID del canal no es válido. Debe comenzar con "UC" y tener exactamente 24 caracteres'
            })
        }

        if (channelName && containsIllegalTags(channelName)) {
            return await interaction.editReply({
                content: 'El nombre del canal contiene menciones ilegales'
            })
        }

        const isIllegalComment = [commentNewVideo || '', commentNewStream || ''].some(comment => containsIllegalTags(comment))
        if (isIllegalComment) {
            return await interaction.editReply({
                content: 'Uno de los comentarios contiene menciones ilegales. No se permiten menciones everyone, here, usuarios ni canales'
            })
        }

        /** @type {YouTubeChannel} */
        let channel = await globalRef.database.collection(COLL_YOUTUBE_CHANNELS).findOne({
            userId: interaction.user.id
        })

        if (channelId) {
            const existingChannel = await globalRef.database.collection(COLL_YOUTUBE_CHANNELS).findOne({
                channelId: channelId,
                userId: { $ne: interaction.user.id }
            });

            if (existingChannel) {
                return await interaction.editReply({
                    content: 'EL ID del canal ya está registrado por otro usuario'
                });
            }
        }

        let oldChannelId = null

        /** @type {string[]} */
        const videoFilterNormalized = videoFilter?.split(',').map(item => item.trim()).filter(Boolean) || [];

        if (!channel) {
            if (!isParametersCompleted) {
                return await interaction.editReply({
                    content: 'Si es la primera vez, debe rellenar todos los campos'
                })
            }

            channel = {
                userId: interaction.user.id,
                channelName,
                channelId,
                commentNewVideo,
                commentNewStream,
                isEnabled: true,
                datetimeSub: Date.now(),
                videoFilter: videoFilterNormalized
            }
        } else {
            oldChannelId = channel.channelId

            if (channelId && oldChannelId !== channelId) {
                channel.channelId = channelId;
                if (channel.isEnabled) {
                    channel.datetimeSub = Date.now();
                }
            }

            channel.channelName = channelName || channel.channelName
            channel.commentNewVideo = commentNewVideo || channel.commentNewVideo
            channel.commentNewStream = commentNewStream || channel.commentNewStream
            channel.videoFilter = videoFilterNormalized
        }

        let isSubscribeSuccessful = true

        if (channel.isEnabled && channelId && oldChannelId !== channelId) {
            if (oldChannelId) {
                const ok = await subscribeUnsubscribe(
                    WEBHOOK_URL,
                    oldChannelId,
                    false
                )

                if (!ok) {
                    return await interaction.editReply({
                        content: 'No se logró desuscribir del canal anterior'
                    })
                }
            }

            isSubscribeSuccessful = await subscribeUnsubscribe(
                WEBHOOK_URL,
                channelId,
                true
            )
        }

        if (channel.isEnabled && !isSubscribeSuccessful) {
            return await interaction.editReply({
                content: 'No se ha podido suscribir tu canal de YouTube. Revisa que el link de tu canal sea válido'
            })
        }

        await globalRef.database.collection(COLL_YOUTUBE_CHANNELS).updateOne(
            { userId: interaction.user.id },
            { $set: channel },
            { upsert: true }
        )

        await interaction.editReply({
            content: 'Configuración del canal actualizada correctamente!'
        })
    } catch (error) {
        try {
            logger.ERR(error)
            if (interaction.deferred) {
                await interaction.editReply('Ha ocurrido un error desconocido. Inténtalo más tarde')
            } else {
                await interaction.reply('Ha ocurrido un error desconocido. Inténtalo más tarde')
            }
        } catch {

        }
    }
}

/**
 * Presents a modal to the user to configure YouTube notification settings.
 * Validates that the user has the required role, loads any existing channel
 * configuration from the database, and pre-fills the modal inputs with that
 * data. The modal allows editing the channel name, channel ID, and custom
 * messages for new videos and streams.
 *
 * @param {ChatInputCommandInteraction} interaction - The Discord interaction
 * that invoked the command.
 * @returns {Promise<Message | void>} Resolves when the modal is shown or an
 * ephemeral error message is returned.
 */
async function configureYoutubeNotifications(interaction) {
    try {
        if (!interaction.member.roles.cache.find(role => role.id === process.env.ID_ROL_NOTABLE)) {
            return await interaction.reply({
                content: 'Usuario no autorizado',
                flags: MessageFlags.Ephemeral
            })
        }

        /** @type {YouTubeChannel} */
        let channel = await globalRef.database.collection(COLL_YOUTUBE_CHANNELS).findOne({
            userId: interaction.user.id
        })

        const modal = new ModalBuilder()
            .setCustomId('configureYoutubeNotifications')
            .setTitle('Configurar Notificaciones de YouTube');

        const labelChannelNameInput = new LabelBuilder(
            {
                description: 'Define el nombre de tu canal de YouTube',
                label: 'Nombre del canal',
                type: ComponentType.TextInput,
                component: new TextInputBuilder({
                    customId: 'channel_name',
                    style: TextInputStyle.Short,
                    value: channel?.channelName || '',
                    required: true
                })
            }
        )

        const labelChannelIdInput = new LabelBuilder(
            {
                description: 'ID del Canal',
                label: 'ID del Canal',
                type: ComponentType.TextInput,
                component: new TextInputBuilder({
                    customId: 'channel_id',
                    style: TextInputStyle.Short,
                    value: channel?.channelId || '',
                    required: true
                })
            }
        )

        const labelVideoMessageInput = new LabelBuilder(
            {
                description: 'El mensaje que se mostrará cuando tu canal publique un nuevo video',
                label: 'Mensaje para nuevos videos',
                type: ComponentType.TextInput,
                component: new TextInputBuilder({
                    customId: 'message_video',
                    style: TextInputStyle.Paragraph,
                    value: channel?.commentNewVideo || '',
                    required: false
                })
            }
        )

        const labelStreamMessageInput = new LabelBuilder(
            {
                description: 'El mensaje que se mostrará cuando tu canal inicie un directo',
                label: 'Mensaje para nuevos directos',
                type: ComponentType.TextInput,
                component: new TextInputBuilder({
                    customId: 'message_stream',
                    style: TextInputStyle.Paragraph,
                    value: channel?.commentNewStream || '',
                    required: false
                })
            }
        )

        const labelVideoFilterInput = new LabelBuilder(
            {
                description: 'Filtra videos que en su titulo contienen palabras clave',
                label: 'Filtro de vídeos',
                type: ComponentType.TextInput,
                component: new TextInputBuilder({
                    customId: 'video_filter',
                    style: TextInputStyle.Paragraph,
                    value: channel?.videoFilter?.join(', ') || '',
                    placeholder: 'No notificar si el título contiene palabras clave. Separar con comas (,)',
                    required: false
                })
            }
        )

        const labelEnableShortsInput = new LabelBuilder(
            {
                description: 'Si está activo, se notificarán también los shorts',
                label: 'Notificar Shorts',
                type: ComponentType.Checkbox,
                component: new CheckboxBuilder({
                    custom_id: 'enable_shorts',
                    default: channel?.enableShorts || false
                })
            }
        )

        /* const channelNameInput = new TextInputBuilder()
            .setCustomId('channel_name')
            .setLabel('Define el nombre de tu canal de YouTube')
            .setStyle(TextInputStyle.Short)
            .setValue(channel?.channelName || '')
            .setRequired(true)

        const channelIdInput = new TextInputBuilder()
            .setCustomId('channel_id')
            .setLabel('ID del Canal')
            .setStyle(TextInputStyle.Short)
            .setValue(channel?.channelId || '')
            .setRequired(true)

        const videoMessageInput = new TextInputBuilder()
            .setCustomId('message_video')
            .setLabel('Mensaje para nuevos videos')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(channel?.commentNewVideo || '')
            .setRequired(false)

        const streamMessageInput = new TextInputBuilder()
            .setCustomId('message_stream')
            .setLabel('Mensaje para nuevos directos')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(channel?.commentNewStream || '')
            .setRequired(false)

        const videoFilterInput = new TextInputBuilder()
            .setCustomId('video_filter')
            .setLabel('Filtro de vídeos')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(channel?.videoFilter?.join(', ') || '')
            .setPlaceholder('No notificar si el título contiene palabras clave. Separar con comas (,)')
            .setRequired(false) */

        /*  const firstRow = new ActionRowBuilder().addComponents(channelNameInput);
         const secondRow = new ActionRowBuilder().addComponents(channelIdInput);
         const thirdRow = new ActionRowBuilder().addComponents(videoMessageInput);
         const fourthRow = new ActionRowBuilder().addComponents(streamMessageInput);
         const fifthRow = new ActionRowBuilder().addComponents(videoFilterInput); 
 
         modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);*/

        modal.addLabelComponents(labelChannelNameInput, labelChannelIdInput, labelVideoMessageInput,
            labelStreamMessageInput, labelVideoFilterInput);

        await interaction.showModal(modal);
    } catch (error) {
        try {
            logger.ERR(error)
            await interaction.editReply('Ha ocurrido un error desconocido. Inténtalo más tarde')
        } catch {

        }
    }
}

/**
 * Simulates and tests a YouTube notification message for the user.
 * 
 * Fetches the user's registered channel configuration and previews either a video
 * or stream notification layout, including the custom message and role mention.
 * 
 * @param {ChatInputCommandInteraction} interaction - The Discord slash command interaction object.
 * @returns {Promise<Message | void>} A promise that resolves when the test notification is sent.
 */
async function testNotification(interaction) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        /** @type {YouTubeChannel} */
        const channel = await globalRef.database.collection(COLL_YOUTUBE_CHANNELS).findOne({
            userId: interaction.user.id
        })

        if (!channel) {
            return await interaction.editReply({
                content: 'No tienes configurado un canal de YouTube en el bot'
            })
        }

        const typeNotif = interaction.options.getString('type')

        if (typeNotif === 'video') {
            await interaction.editReply({
                content: `<@&${process.env.ID_ROL_YOUTUBE_NOTIFICACIONES}>\n${channel.commentNewVideo} https://youtu.be/E_xqy5GjjzI`
            })
        } else if (typeNotif === 'stream') {
            await interaction.editReply({
                content: `<@&${process.env.ID_ROL_YOUTUBE_NOTIFICACIONES}>\n${channel.commentNewStream} https://youtu.be/E_xqy5GjjzI`
            })
        } else {
            await interaction.editReply({
                content: 'Tipo de notificación no válido'
            })
        }
    } catch (error) {
        try {
            logger.ERR(error)
            await interaction.editReply('Ha ocurrido un error desconocido. Inténtalo más tarde')
        } catch {

        }
    }
}

/**
 * Handles submission of the YouTube configuration modal.
 * Extracts form values from the modal interaction and attaches them
 * to the interaction as `youtubeNotificationData`, then calls
 * `configure` to apply the new settings.
 *
 * @param {ModalSubmitInteraction} interaction - The Discord modal interaction object containing
 * the submitted text input fields: `channel_name`, `channel_id`, `message_video`, and `message_stream`.
 * @returns {Promise<void>} Resolves after calling configure(interaction).
 */
async function handleModalSubmit(interaction) {
    interaction.youtubeNotificationData = {
        channelName: interaction.fields.getTextInputValue('channel_name'),
        channelId: interaction.fields.getTextInputValue('channel_id'),
        commentNewVideo: interaction.fields.getTextInputValue('message_video'),
        commentNewStream: interaction.fields.getTextInputValue('message_stream'),
        videoFilter: interaction.fields.getTextInputValue('video_filter')
    }

    await configure(interaction)
}


/**
 * Build an embed containing a list of YouTube channels.
 * 
 * @param {object[]} channels - Array of channel objects to display.
 * @param {number} skip - Number of items skipped for pagination.
 * @param {number} limit - Maximum number of items shown per page.
 * @returns {EmbedBuilder}
 */
function getEmbedChannels(channels, skip, limit) {
    const embed = new EmbedBuilder()
    embed.setTitle('Lista de canales de YouTube')
    embed.setDescription(channels.map(channel => `\`\`\`\nuserId: ${channel.userId}\nchannelName: ${channel.channelName}\nchannelId: ${channel.channelId}\n\`\`\``).join('\n'))
    return embed
}

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
 * List stored YouTube channels in a paginated embed for staff members.
 * @param {ChatInputCommandInteraction} interaction - The command interaction used to send the response.
 */
async function listYouTubeChannels(interaction) {
    try {
        if (!utils.isStaff(interaction.member)) {
            return interaction.reply('Comando de uso exclusivo para el Staff del servidor')
        }

        const getChannels = async (skip, limit) => {
            return await globalRef.database.collection(COLL_YOUTUBE_CHANNELS).find(
                {}, {
                projection: {
                    _id: 0,
                    userId: 1,
                    channelName: 1,
                    channelId: 1
                }
            }).skip(skip).limit(limit).toArray()
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        const limit = 8
        const totalCount = await globalRef.database.collection(COLL_YOUTUBE_CHANNELS).countDocuments()
        const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / limit)
        let page = 1

        const buildResponse = async (page) => {
            const skip = (page - 1) * limit
            const channels = await getChannels(skip, limit)
            const embed = getEmbedChannels(channels, skip, limit)
            const row = createButtonRow(page, totalPages)
            return { embeds: [embed], components: [row] }
        }

        const initial = await buildResponse(page)
        await interaction.editReply(initial)
        const msg = await interaction.fetchReply()

        const collector = msg.createMessageComponentCollector({ time: 120000 })
        collector.on('collect', async i => {
            try {
                if (i.customId === 'prev') {
                    if (page > 1) page--
                } else if (i.customId === 'next') {
                    if (page < totalPages) page++
                } else if (i.customId === 'close') {
                    const disabledRow = createButtonRow(page, -1)
                    await i.update({ components: [disabledRow] })
                    collector.stop()
                    return
                }

                await i.update(await buildResponse(page))
            } catch (err) {
                logger.ERR(err)
            }
        })

        collector.on('end', async () => {
            try {
                const disabledRow = createButtonRow(page, -1)
                await msg.edit({ components: [disabledRow] })
            } catch (err) {
                logger.ERR(err)
            }
        })
    } catch (error) {
        logger.ERR(error)
    }
}

module.exports = {
    setEnabled,
    testNotification,
    subscribeUnsubscribe,
    configureYoutubeNotifications,
    handleModalSubmit,
    listYouTubeChannels
}