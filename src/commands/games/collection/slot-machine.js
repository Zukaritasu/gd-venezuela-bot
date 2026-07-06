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

const utils = require("../../../utils.js");
const logger = require("../../../logger.js");
const profile = require('../profile.js')

const TYPE_SLOT_MACHINE = "slot_machine";

const encouragingMessages = [
	"¡Sigue intentándolo! La próxima vez podrías tener más suerte.",
	"¡No te desanimes! Cada intento es una oportunidad para ganar.",
	"¡La suerte está de tu lado! Intenta de nuevo y podrías sorprenderte.",
	"¡No te rindas! La próxima vez podrías obtener un gran premio.",
	"¡Sigue jugando! La emoción está en cada giro.",
	"¡No te preocupes! La próxima vez podrías tener un resultado mejor.",
	"¡La suerte puede cambiar en cualquier momento! Intenta de nuevo.",
	"¡No te desanimes! Cada giro es una nueva oportunidad.",
	"¡Sigue intentándolo! La próxima vez podrías tener un gran premio.",
	"¡No te rindas! La emoción del juego está en cada intento."
];

const demonEmojis = [
	"<:extreme_demon:1523696219577258006>", // 100 points
	"<:insane_demon:1523696218495258714>", // 50 points
	"<:hard_demon:1523696217446416615>", // 25 points
	"<:medium_demon:1523696214191771789>", // 10 points
	"<:easy_demon:1523696212992065756>" // 5 points
];

const demonPoints = {
	"<:extreme_demon:1523696219577258006>": 100,
	"<:insane_demon:1523696218495258714>": 50,
	"<:hard_demon:1523696217446416615>": 25,
	"<:medium_demon:1523696214191771789>": 10,
	"<:easy_demon:1523696212992065756>": 5
};

/**
 * Slot Machine Command
 * @param {import("discord.js").CommandInteraction} interaction - The command interaction object
 */
async function slotMachineCommand(interaction) {
	try {
		await interaction.deferReply();

		const timeDifference = { time: 0 };
		if (await profile.isCooldownActive(interaction.user.id, TYPE_SLOT_MACHINE, timeDifference)) {
			await interaction.reply({
				content: `Por favor, espera ${utils.formatTimeMilliseconds(timeDifference.time)} antes de intentarlo de nuevo.`,
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		const slots = [
			demonEmojis[Math.floor(Math.random() * demonEmojis.length)], 
			demonEmojis[Math.floor(Math.random() * demonEmojis.length)], 
			demonEmojis[Math.floor(Math.random() * demonEmojis.length)]
		];

		const message = `${slots.join(" ")}`;
		await interaction.editReply({ content: message });

		// Check if all slots are the same
		const isWin = slots.every(slot => slot === slots[0]);

		let points = 0;
		if (isWin) {
			points = demonPoints[slots[0]] * 3; // Triple the points for three matching symbols
			await interaction.channel.send(`${interaction.user} ¡Felicidades! Has ganado **${points} puntos**`);
		} else if (slots[0] !== slots[1] && slots[1] !== slots[2] && slots[0] !== slots[2]) {
			await interaction.channel.send(`${interaction.user} ¡No has ganado esta vez! No hay demons repetidos. ¡Sigue intentándolo!`);
		} else {
			const repeatedSlot = slots.sort()[1]; // Get the middle slot after sorting
			points = demonPoints[repeatedSlot] * 2; // Double the points for two matching symbols
			const randomMessage = encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)];
			await interaction.channel.send(`${interaction.user} ¡No has ganado esta vez! Has obtenido **${points} puntos**. ${randomMessage}`);
		}

		await profile.savePoints(interaction.user.id, points, null, TYPE_SLOT_MACHINE, 60000); // 1 minute cooldown
	} catch (e) {
		logger.ERR(`Error executing slot machine command: ${e.message}`, e);
		try {
			await interaction.editReply({ content: "Ha ocurrido un error desconocido. Por favor, inténtalo de nuevo más tarde." });
		} catch {
			
		}
	}
}

module.exports = {
	slotMachineCommand
}