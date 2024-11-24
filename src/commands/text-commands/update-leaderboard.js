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

const { Message } = require('discord.js');
const { Db } = require('mongodb');

module.exports = {
    /**
     * @param {Db} database 
     * @param {Message} message 
     * @returns 
     */
    update: async (database, message) => {
        try {
            const embed = await require('../../commands/utilities/xp').getTop15XPEmbed(database, message)
            if (!embed)
                return await message.reply('La lista de usuarios no está disponible <:ani_okitathinking:1244840221376512021>')
            const channel = await message.guild.channels.fetch('1304937321107423283')
            const botMessage = await channel.messages.fetch('1304939931248099348');
            await botMessage.edit(
                {
                    content: '**Top 15 usuarios con mas XP de Texto en el servidor!**\n\n:warning:  Recuerda que el **Staff** y los usuarios con rol **Notable** no forman parte del Top\nPara ganar experiencia (XP), solo tienes que participar activamente en los canales de texto del servidor enviando mensajes de __texto, emojis, stickers__, etc. Todo lo referente a los canales de texto.\n\n**Para mas información puedes usar los siguientes comandos**\n- \`/utilidades top xp\` Muestra el Top 15\n- \`/utilidades top rank\` Muestra tu posición en el Top 25 \n\n*Si sales del Top 15, el rol se mantendrá contigo hasta que llegues al Top 25; si bajas otro nivel, lamentablemente perderás el rol, así que mantente activo!!!*',
                    embeds: [embed]
                }
            )

            await message.reply('Successfully updated!')
        } catch (error) {
            console.error(error)
            try {
                await message.reply({
                    content: 'Ups! Ha ocurrido un error. Intenta mas tarde... <:birthday2:1249345278566465617>'
                })
            } catch (e) {

            }
        }
    }
}