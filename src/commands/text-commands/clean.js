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

const { Message } = require("discord.js");

module.exports = {
    /** @param {Message} message */
    clean: async (message) => {
        const channel = message.channel
        if (channel.id !== '1303235564274712586') {
            await message.reply('Comando solo disponible en <#1303235564274712586>')
        } else {
            async function clearChannel(channel) {
                const fetched = await channel.messages.fetch({ limit: 100 });
                if (fetched.size > 0) {
                        await channel.bulkDelete(fetched, true).catch(console.error);
                    clearChannel(channel);
                }
            }

            await clearChannel(channel);
        }
    }
}