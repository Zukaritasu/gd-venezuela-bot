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

const { Message, TextChannel } = require("discord.js");
const logger = require("../../logger");
const channels = require("../../../.botconfig/channels.json");

module.exports = {
    /** @param {Message} message */
    clean: async (message) => {
        const channel = message.channel
        if (channel.id !== channels.BOT_MODERATION) {
            await message.reply(`Comando solo disponible en <#${channels.BOT_MODERATION}>.`)
        } else {
            /** @param {TextChannel} channel */
            async function clearChannel(channel) {
                const fetched = await channel.messages.fetch({ limit: 100 });
                if (fetched.size > 0) {
                    for (let i = fetched.size - 1; i >= 0; i--)
                        await fetched.at(i).delete().catch(logger.ERR);
                    clearChannel(channel);
                }
            }

            await clearChannel(channel);
        }
    }
}