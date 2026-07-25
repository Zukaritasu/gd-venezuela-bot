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

const { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageComponentInteraction, MessageFlags, Client } = require('discord.js');

const axios = require('axios');
const { Db } = require('mongodb');
const crypto = require('crypto');
const logger = require('../logger');
const robtopapi = require('../robtopapi')
const utils = require('../utils')
const { PASSWORDGDBOT, ACCOUNTIDGDBOT } = require('../../.botconfig/token.json')
const { COLL_GD_PROFILES } = require('../../.botconfig/database-info.json');

const ERROR_TIMEOUT_MESSAGE = 'Collector received no interactions before ending with reason: time'

/**
 * Generates a verification code used for friend registration.
 * The code format is "AAA-BBB" where each letter is a random
 * uppercase character from A-Z.
 *
 * @returns {string} A newly generated verification code (e.g. "QWE-RTY").
 */
function generateCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';

    for (let i = 0; i < 3; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));    }

    code += '-';

    for (let i = 0; i < 3; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return code;
}

/**
 * Build the interaction payload asking the user to send a friend
 * request to the official account with the provided verification code.
 * 
 * @param {string} code - Verification code to include in the message.
 * @returns {{content: string, components: import('discord.js').ActionRowBuilder[]}}
 * Message payload suitable for `interaction.editReply` or `interaction.reply`.
 */
function createEmbed(code) {
    return {
        content: `Desde el juego, debe enviar solicitud de amistad a la cuenta **OfficialGDVzla** con el código **${code}** de comentario. Después de enviar la solicitud, debe presionar el botón **Aceptar** para finalizar.\n\n*Tiene 5 minutos antes de que el código expire...*`,
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('accept')
                    .setLabel('Aceptar')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setLabel('Vídeo demostrativo')
                    .setURL('https://youtu.be/qX5YbeiFD7E')
                    .setStyle(ButtonStyle.Link)
            )
        ]
    }
}

/**
 * Verify the provided friend-request verification code against the
 * OfficialGDVzla account's friend requests and, on success, insert
 * a profile link into the database.
 *
 * This function queries the RobTop API for pending friend requests,
 * searches for a request whose comment matches `code`, and then
 * stores the association between the Discord `userId` and the
 * Geometry Dash `playerID` / `accountID` in the configured collection.
 *
 * @param {Db} database - MongoDB database instance used to persist the link.
 * @param {string} userId - Discord user ID that will be associated with the GD profile.
 * @param {string} code - Verification code to look for in friend request comments.
 * @returns {Promise<string>} Human-readable result message describing success or the error.
 */
async function linkProfile(database, userId, code) {
    const response = await robtopapi.getGJFriendRequests20(
        ACCOUNTIDGDBOT,
        crypto.createHash('sha1').update(`${PASSWORDGDBOT}mI29fmAnxgTs`).digest('hex')
    )

    if (!response || response === '-1' || response === '-2') {
        return 'Ha ocurrido un error desconocido. Por favor, intente más tarde'
    }

    const requests = response.split('#')[0].split('|').map(request => robtopapi.extractKeyValuePairs(request))
    const request = requests.find(map => map.get('message') === code)
    if (!request) {
        return 'El codigo es invalido o aún no has enviado la solicitud de amistad a la cuenta con el código de comentario.\nSi lo has hecho, elimina la solicitud de amistad e inténtalo de nuevo.'
    }

    const result = await database.collection(COLL_GD_PROFILES).insertOne(
        {
            userId,
            playerID: request.get('playerID'),
            accountID: request.get('accountID')
        }
    )

    if (!result.acknowledged) {
        return 'Ha ocurrido un error al vincular tu perfil. Por favor, inténtalo más tarde.\nSi el problema persiste, contacta con <@591640548490870805>.'
    }

    return 'Se ha vinculado con éxito tu perfil de GD!'
}

/**
 * Handle the command flow: validate the Discord member, ensure they
 * have the required role, generate a verification code, prompt the
 * user to send the friend request, wait for the confirmation button
 * and finally attempt to link the profile in the database.
 *
 * @param {Db} database - MongoDB database instance.
 * @param {ChatInputCommandInteraction} interaction - The interaction that triggered the command.
 * @returns {Promise<void>} Resolves when the operation completes (successfully or not).
 */
async function processCode(database, interaction) {
    try {
        const userId = interaction.member.id
        const member = interaction.guild.members.cache.get(userId)

        if (!member) {
            return await utils.reply(interaction, 
                'Tu usuario no se encontro en el servidor. Intenta mas tarde'
            )
        }

        if (!member.roles.cache.find(role => role.id === process.env.ID_ROL_VENEZOLANO)) {
            return await utils.reply(interaction, 
                'Debes ser Venezolano para continuar...'
            )
        }

        const profile = await database.collection(COLL_GD_PROFILES).findOne({ userId })
        if (profile) {
            return await utils.reply(interaction, 
                'Tu perfil de Geometry Dash ya está vinculado al bot!'
            )
        }

        const code = generateCode();
        const response = await interaction.editReply(createEmbed(code));

        const collectorFilter = i => i.user.id === userId;
        const confirmation = await response.awaitMessageComponent(
            {
                filter: collectorFilter,
                time: 300000 // 5 min
            }
        );

        if (confirmation.customId === 'accept') {
            const content = await linkProfile(database, userId, code)
            await confirmation.update({ embeds: [], content, components: [] })
        } else { // cancel
            await interaction.deleteReply()
        }
    } catch (e) {
        try {
            let content = null

            if (e.message !== ERROR_TIMEOUT_MESSAGE) {
                logger.ERR(e)
                content = 'Ha ocurrido un error desconocido. Por favor, intente más tarde'
            } else {
                content = 'El tiempo límite de 5 minutos ha finalizado. Por favor, intente volver a realizar la operación nuevamente'
            }

            await utils.reply(interaction, {embeds: [], content, components: []})
        } catch {
            /** Do not catch the exception */
        }
    }
}

/**
 * Command entrypoint invoked by the command dispatcher.
 * It defers an ephemeral reply and delegates to `processCode`.
 *
 * @param {Client} _ - Discord Client instance (unused, kept for signature compatibility).
 * @param {Db} database - MongoDB database instance.
 * @param {ChatInputCommandInteraction} interaction - The interaction representing the command invocation.
 * @returns {Promise<void>} Resolves when command handling finishes.
 */
async function execute(_, database, interaction) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await processCode(database, interaction);
    } catch (error) {
        logger.ERR(error)
        await utils.reply(interaction, 'An unknown error has occurred. Please try again later');
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vincular')
        .setDescription('Vincula tu perfil de GD al bot para mejorar sus funciones'),
    execute,
};