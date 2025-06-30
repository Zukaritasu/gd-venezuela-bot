/**
 * Copyright (C) 2025 Zukaritasu
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

const { SlashCommandBuilder, ChatInputCommandInteraction, Message, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } = require('discord.js');
const { Db } = require('mongodb');
const logger = require('../../logger');

/**
 * @param {CLient} _client 
 * @param {Db} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, _database, interaction) {
    try {
        await interaction.deferReply();

        /*if (interaction.member.user.id !== '591640548490870805') {
            await interaction.editReply('El comando no se encuentra disponible en este momento. Por favor, intenta más tarde.');
            return;
        }*/

        const pages = [
            new EmbedBuilder()
                .setTitle('REQUISITOS PARA ENVIAR UN RECORD')
                .setDescription(
                    '**Ser Venezolano**\n\n' +
                    'Debes tener previamente creado un perfil con el comando `/records perfil crear`. Si aún no tienes un perfil creado, pero sí un registro subido en la **GDVZLA LIST**, debes crear tu perfil con el mismo nombre de usuario que tienes en tu record.\n\n' +
                    'El record debe enviarse en el canal <#1368411272965525684>. El bot GDVenezuelaBot reaccionará a tu mensaje con un ✅ si todo está correcto o con un ❌ si algo está mal. En ese caso, el bot te enviará un mensaje directo explicándote qué es lo que has hecho mal. Sin embargo, si tienes el DM cerrado, el bot te responderá en el canal <#1119803120994750536>. Si el bot no reacciona a tu mensaje, es posible que no se encuentre en línea; en ese caso, intenta reenviar el mensaje más tarde. Si el bot está en línea y aún no reacciona, significa que se ha producido un error interno del bot. En ese caso, debes notificárselo a <@591640548490870805>.\n\n' +
                    'El formato del mensaje se explica en el [Mensaje Fijado](https://discord.com/channels/1119795689984102455/1368411272965525684/1376616796341141625) del canal <#1368411272965525684>. Si no sigues el formato, el bot no podrá procesar tu record.\n'
                )
                .setColor(0x2b2d31),
            new EmbedBuilder()
                .setTitle('Preguntas Frecuentes')
                .setFields(
                    {
                        name: '¿Puedo enviar los records de otro usuario?',
                        value: 'Está prohibido enviar los records de otro usuario en su nombre; solo los usuarios con el rol de <@&1121221914254397592>, superior o autorizados pueden hacerlo.'
                    },
                    {
                        name: '¿Es posible crear perfiles para otros usuarios?',
                        value: 'Está prohibido crear perfiles a otros usuarios; solo los propios usuarios pueden crearlos. Los usuarios con los roles <@&1121221914254397592>, superior o autorizados pueden crear perfiles ajenos.'
                    },
                    {
                        name: '¿Existe otro método para enviar los registros?',
                        value: 'El bot cuenta con el comando `/records enviar`, solo tienes que rellenar los parámetros que pide y luego enviar.'
                    },
                    {
                        name: '¿Puedo enviar cualquier nivel, independientemente de su posición?',
                        value: 'Solo puedes subir records de niveles que se encuentren dentro del Top 150 de nuestra lista. Cuando un nivel cae fuera del Top 150, aceptamos records durante 24 horas desde el momento en que cae. Después de ese tiempo, el nivel ya no se aceptará y no podrás enviar records de él.'
                    },
                    {
                        name: '¿Cómo puedo reclamar un pack?',
                        value: 'Los packs de niveles solo pueden ser reclamados por usuarios dentro del círculo del servidor. Para obtener más información, te recomiendo que te pongas en contacto con un moderador de la lista.'
                    }
                )
                .setColor(0x2b2d31)
        ];

        let page = 0;

        const getRow = () => new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setEmoji({
                        id: '1044790805501575228',
                        name: 'arrowleft'
                    })
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setEmoji({
                        id: '1044790809804943410',
                        name: 'arrowright'
                    })
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === pages.length - 1)
            );

        const reply = await interaction.editReply({ embeds: [pages[page]], components: [getRow()] });

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 2 * 60 * 1000 // 2 minutes
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply(
                    {
                        content: 'Solo quien ejecutó el comando puede usar los botones.',
                        ephemeral: true
                    });
                return;
            }

            if (i.customId === 'next' && page < pages.length - 1) {
                page++;
            } else if (i.customId === 'prev' && page > 0) {
                page--;
            }

            await i.update(
                {
                    embeds: [pages[page]],
                    components: [getRow()]
                });
        });

        collector.on('end', async () => {
            const disabledRow = getRow();
            disabledRow.components.forEach(btn => btn.setDisabled(true));
            await interaction.editReply(
                {
                    components: [disabledRow]
                }
            );
        });

    } catch (e) {
        logger.ERR(`Error al ejecutar el comando help: ${e}`);
        try {
            await interaction.editReply('An unknown error has occurred');
        } catch { }
    }
}

module.exports = {
    execute
}