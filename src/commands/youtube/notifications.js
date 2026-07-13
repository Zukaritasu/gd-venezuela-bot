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

const { ChatInputCommandInteraction, GuildMember, MessageFlags, ModalSubmitInteraction, ActionRowBuilder, TextInputBuilder, ModalBuilder, TextInputStyle } = require("discord.js");
const { COLL_YOUTUBE_CHANNELS } = require('../../../.botconfig/database-info.json')
const { YOUTUBE_WEBHOOK_SECRET, YOUTUBE_NOTIFICATIONS_PORT } = require('../../../.botconfig/token.json')
const { Db } = require("mongodb");
const axios = require('axios')
const logger = require('../../logger')
const { PUBLIC_IP } = require('../../../.botconfig/token.json')

const WEBHOOK_URL = `http://${PUBLIC_IP}:${YOUTUBE_NOTIFICATIONS_PORT}/youtube-webhook`;

/**
 * @typedef {Object} YouTubeChannel
 * 
 * @property {string} userId
 * @property {string} channelName
 * @property {string} channelId
 * @property {string} commentNewVideo
 * @property {string} commentNewStream
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

        const isModalSubmit = interaction.isModalSubmit()

        if (isModalSubmit && !('youtubeNotificationData' in interaction)) {
            throw new Error('Configuration data not found')
        }

        const channelName = isModalSubmit ? interaction.youtubeNotificationData.channelName : 
            interaction.options.getString('channel_name')
        
        const channelId = isModalSubmit ? interaction.youtubeNotificationData.channelId : 
            interaction.options.getString('channel_id')

        const commentNewVideo = isModalSubmit ? interaction.youtubeNotificationData.commentNewVideo : 
            interaction.options.getString('message_video')

        const commentNewStream = isModalSubmit ? interaction.youtubeNotificationData.commentNewStream :
            interaction.options.getString('message_stream')

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
                datetimeSub: Date.now()
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
 * 
 * @param {ChatInputCommandInteraction} interaction
 * @returns {Promise<Message | void>}
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

        const channelNameInput = new TextInputBuilder()
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

        const firstRow = new ActionRowBuilder().addComponents(channelNameInput);
        const secondRow = new ActionRowBuilder().addComponents(channelIdInput);
        const thirdRow = new ActionRowBuilder().addComponents(videoMessageInput);
        const fourthRow = new ActionRowBuilder().addComponents(streamMessageInput);

        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

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
 * @param {ModalSubmitInteraction} interaction - The Discord modal interaction object.
 */
async function handleModalSubmit(interaction) {
    interaction.youtubeNotificationData = {
        channelName: interaction.fields.getTextInputValue('channel_name'),
        channelId: interaction.fields.getTextInputValue('channel_id'),
        commentNewVideo: interaction.fields.getTextInputValue('message_video'),
        commentNewStream: interaction.fields.getTextInputValue('message_stream')
    }

    await configure(interaction)
}

module.exports = {
	setEnabled,
	testNotification,
	subscribeUnsubscribe,
    configureYoutubeNotifications,
    handleModalSubmit
}