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

const { Message } = require("discord.js");
const logger = require("../../logger.js");


/**
 * Selects a random winner from the users who reacted to a giveaway message with a specific emoji.
 * The command should be used in the format: --winner <id_message> <id_channel> <emoji>
 * Example: --winner 123456789012345678 987654321098765432 🎉
 * 
 * @param {Message} message 
 * @param {string[]} params - <id_message> <id_channel> <emoji> <count_winners>
 */
async function winner(message, params) {
    if (params.length < 4) { 
        await message.reply("Example: --winner <id_message> <id_channel> <emoji> <count_winners>");
        return;
    }

    const giveawayMessageId = params[0];
    const channelId = params[1];
    let giveawayEmoji = params[2];
    const countWinners = parseInt(params[3]);

    if (giveawayEmoji.includes(':')) {
        giveawayEmoji = giveawayEmoji.split(':').pop().replace('>', '');
    }

    try {
        /** @type {import("discord.js").TextChannel} */
        const channel = await message.guild.channels.fetch(channelId);
        if (!channel || channel.type !== 0) {
            await message.reply("The specified channel ID is invalid or is not a text channel.");
            return;
        }

        const giveawayMessage = await channel.messages.fetch(giveawayMessageId);
        const reaction = giveawayMessage.reactions.cache.find(r => 
            r.emoji.name === giveawayEmoji || r.emoji.id === giveawayEmoji
        );

        if (!reaction) {
            await message.reply("No reaction was found for that emoji in the specified message");
            return;
        }

        const users = await reaction.users.fetch();
        const winnerUsers = users.filter(user => !user.bot).random(countWinners);
        
        if (!winnerUsers || winnerUsers.length === 0) {
            await message.reply("No valid participants (humans) were found in the reaction.");
            return;
        }

        if (winnerUsers.length === 1) {
            await channel.send(`¡Felicidades ${winnerUsers[0]}! Es el ganador del sorteo. `
                + `Por favor, ponte en contacto con el organizador.`
            );
            return;
        }
        
        await channel.send(`¡Felicidades ${winnerUsers.join(', ')}! Son los ganadores del sorteo. `
            + `Por favor, ponte en contacto con el organizador.`
        );
        
    } catch (error) {
        logger.ERR(error);
        await message.reply('There was an error selecting the winner. Please make sure the IDs and emoji are correct');
    }
}

module.exports = {
    winner,
}