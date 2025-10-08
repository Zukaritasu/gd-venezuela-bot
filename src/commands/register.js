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

const { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageComponentInteraction } = require('discord.js');

const axios = require('axios');
const { Db } = require('mongodb');
const crypto = require('crypto');
const logger = require('../logger');
const { PASSWORDGDBOT, ACCOUNTIDGDBOT } = require('../../.botconfig/token.json')
const { COLL_GD_PROFILES } = require('../../.botconfig/database-info.json');

/////////////////////////////////////////////

const ERROR_TIMEOUT_MESSAGE = 'Collector received no interactions before ending with reason: time'

const keysValues = [
    {
        key: 1,
        value: 'userName'
    },
    {
        key: 2,
        value: 'playerID'
    },
    {
        key: 9,
        value: 'icon'
    },
    {
        key: 10,
        value: 'playerColor'
    },
    {
        key: 11,
        value: 'playerColor2'
    },
    {
        key: 14,
        value: 'iconType'
    },
    {
        key: 15,
        value: 'glow'
    },
    {
        key: 16,
        value: 'accountID'
    },
    {
        key: 32,
        value: 'friendRequestID'
    },
    {
        key: 35,
        value: 'message'
    },
    {
        key: 37,
        value: 'age'
    },
    {
        key: 41,
        value: 'NewFriendRequest'
    },
]

/**********************************/

/**
 * 
 * @returns string
 */
function generateCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';

    for (let i = 0; i < 3; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    code += '-';

    for (let i = 0; i < 3; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return code;
}

/**
 * 
 * @param {string} code 
 * @returns 
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
 * 
 * @param {number} accountID 
 * @param {string} gjp2 
 * @returns 
 */
async function getGJFriendRequests20(accountID, gjp2) {
    const data = new URLSearchParams({
        "secret": "Wmfd2893gb7",
        "accountID": accountID,
        "gjp2": gjp2
    });

    return axios.post('http://www.boomlings.com/database/getGJFriendRequests20.php', data, {
        headers: {
            'User-Agent': '',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
}

/**
 * 
 * @param {string} str 
 * @returns {Map<string, string>}
 */
function extractKeyValuePairs(str) {
    const map = new Map();
    let key = '';
    let value = '';
    let isKey = true;

    const addProperty = () => {
        const item = keysValues.find(item => item.key == parseInt(key));
        if (item.value === 'message')
            value = Buffer.from(value, 'base64').toString('utf-8')
        map.set(item.value, value);
    }

    for (let i = 0; i < str.length; i++) {
        if (str[i] === ':') {
            if (isKey) {
                isKey = false;
            } else {
                addProperty()
                key = ''; value = '';
                isKey = true;
            }
        } else {
            if (isKey) {
                key += str[i];
            } else {
                value += str[i];
            }
        }
    }

    addProperty()

    return map;
}

/**
 * 
 * @param {Db} database 
 * @param {ChatInputCommandInteraction} interaction 
 * @param {MessageComponentInteraction} confirmation 
 * @param {string} code 
 */
async function checkMessage(database, interaction, confirmation, code) {
    const data = (await getGJFriendRequests20(ACCOUNTIDGDBOT,
        crypto.createHash('sha1').update(`${PASSWORDGDBOT}mI29fmAnxgTs`).digest('hex'))).data.toString()
    if (data === '-1' || data === '-2') {
        confirmation.update(
            {
                embeds: [],
                content: 'Ha ocurrido un error desconocido. Por favor, intente más tarde',
                components: []
            }
        )
        return false
    }

    const requests = data.split('#')[0].split('|').map(request => extractKeyValuePairs(request))
    const request = requests.find(map => map.get('message') === code)
    if (!request) {
        confirmation.update(
            {
                embeds: [],
                content: 'El codigo es invalido o aún no has enviado la solicitud de amistad a la cuenta con el código de comentario.\nSi lo has hecho, elimina la solicitud de amistad e inténtalo de nuevo.',
                components: []
            }
        )
        return false
    } else {
        const gdProfiles = database.collection(COLL_GD_PROFILES)
        const result = await gdProfiles.insertOne(
            {
                userId: interaction.member.id,
                playerID: request.get('playerID'),
                accountID: request.get('accountID')
            }
        )

        if (!result.acknowledged) {
            confirmation.update(
                {
                    embeds: [],
                    content: 'Ha ocurrido un error al vincular tu perfil. Por favor, inténtalo más tarde.\nSi el problema persiste, contacta con <@591640548490870805>.',
                    components: []
                }
            )
            return false
        }
    }
    return true
}

/**
 * 
 * @param {*} database 
 * @param {ChatInputCommandInteraction} interaction 
 * @return {Promise<void>}
 */
async function processCode(database, interaction) {
    try {
        const member = interaction.guild.members.cache.get(interaction.member.id)
        if (!member) {
            await interaction.editReply(
                {
                    content: 'Tu usuario no se encontro en el servidor. Intenta mas tarde'
                }
            );
            return
        }

        if (!member.roles.cache.find(role => role.id === '1119804850620866600')) {
            await interaction.editReply(
                {
                    content: 'Debes ser Venezolano para continuar...'
                }
            );
            return
        }

        const profile = await database.collection(COLL_GD_PROFILES).findOne({
            userId: interaction.member.id
        })

        if (profile) {
            return await interaction.editReply(
                {
                    content: 'Tu perfil de Geometry Dash ya está vinculado al bot <:Cubo_Aleczd:1126884738108502106>',
                }
            );
        }

        const code = generateCode();
        const response = await interaction.editReply(createEmbed(code));

        const collectorFilter = i => i.user.id === interaction.user.id;
        const confirmation = await response.awaitMessageComponent(
            {
                filter: collectorFilter,
                time: 300000 // 5 min
            }
        );

        if (confirmation.customId === 'accept') {
            if (await checkMessage(database, interaction, confirmation, code)) {
                confirmation.update(
                    {
                        embeds: [],
                        content: 'Se ha vinculado con éxito tu perfil de GD al del bot!',
                        components: []
                    }
                )
            }
        } else { // cancel
            await interaction.deleteReply(response)
        }
    } catch (e) {
        try {
            if (e.message !== ERROR_TIMEOUT_MESSAGE) {
                logger.ERR(e)
                await interaction.editReply(
                    {
                        embeds: [],
                        content: 'Ha ocurrido un error desconocido. Por favor, intente más tarde',
                        components: []
                    }
                );
            } else {
                await interaction.editReply(
                    {
                        embeds: [],
                        content: 'El tiempo límite de 5 minutos ha finalizado. Por favor, intente volver a realizar la operación nuevamente',
                        components: []
                    }
                );
            }
        } catch {
            /** Do not catch the exception */
        }
    }
}

/**
 * 
 * @param {*} client 
 * @param {*} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, database, interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        await processCode(database, interaction);
    } catch (error) {
        logger.ERR(error)
        await interaction.editReply('An unknown error has occurred. Please try again later');
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vincular')
        .setDescription('Vincula tu perfil de GD al bot para mejorar sus funciones'),
    execute,
};