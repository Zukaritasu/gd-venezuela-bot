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

const { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } = require("discord.js");
const profile = require('./profile.js')

const chest = {
	small: {
		image: "https://media.discordapp.net/attachments/1294668385950498846/1523725748668731402/SmallChest.png",
		color: 0xCD7C44,
		randomOrbe: [7, 14, 21, 28, 35, 42, 49, 56, 63, 70],
		wait: "3 horas",
		waitMs: 10800000
	},
	daily: {
		image: "https://cdn.discordapp.com/attachments/1294668385950498846/1523725749637615616/LargeChest.png",
		color: 0x4E8EEE,
		randomOrbe: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
		randomKey: [1, 2],
		wait: "24 horas",
		waitMs: 86400000
	},
	weekly: {
		image: "https://cdn.discordapp.com/attachments/1294668385950498846/1523725749310328882/1KeyChest.png",
		color: 0x4C4A48,
		randomOrbe: [30, 50, 70, 90, 110, 130, 150, 170, 190, 210],
		randomKey: [1, 2, 3, 4, 5],
		wait: "7 días",
		waitMs: 604800000
	}
}

function padEnding(str, length) {
	while (str.length < length) {
		str += " ";
	}
	return str;
}

/**
 * Returns the rewards for opening a chest based on the subcommand.
 * @param {string} subcommand - The subcommand indicating the type of chest opened.
 * @returns {{manaOrbes: number, chestKeys: number | undefined}} An object containing the rewards received from the chest.
 */
function getRewards(subcommand) {
	switch (subcommand) {
		case "small":
			return {
				manaOrbes: chest.small.randomOrbe[Math.floor(Math.random() * chest.small.randomOrbe.length)]
			}
		case "daily":
			if (Math.random() < 0.5) {
				return {
					manaOrbes: chest.daily.randomOrbe[Math.floor(Math.random() * chest.daily.randomOrbe.length)],
					chestKeys: chest.daily.randomKey[Math.floor(Math.random() * chest.daily.randomKey.length)]
				}
			}
			return {
				manaOrbes: chest.daily.randomOrbe[Math.floor(Math.random() * chest.daily.randomOrbe.length)]
			};
		case "weekly":
			return {
				manaOrbes: chest.weekly.randomOrbe[Math.floor(Math.random() * chest.weekly.randomOrbe.length)],
				chestKeys: chest.weekly.randomKey[Math.floor(Math.random() * chest.weekly.randomKey.length)]
			};
		default:
			return {
				manaOrbes: 0,
				chestKeys: 0
			};
	}
}

function toStringRewards(rewards) {
	const rewardStrings = [];
	if (rewards.manaOrbes) {
		rewardStrings.push(`\`${padEnding(rewards.manaOrbes.toString(), 8)}\` <:mana_orbe:1523732878347997344> orbes`);
	}
	if (rewards.chestKeys) {
		rewardStrings.push(`\`${padEnding(rewards.chestKeys.toString(), 8)}\` <:chest_key:1523739081341800509> llave(s)`);
	}
	return rewardStrings;
}

/**
 * Opens a chest based on the specified subcommand and replies with the results.
 * @param {ChatInputCommandInteraction} interaction 
 * @param {string} subcommand 
 */
async function openChestCommand(interaction, subcommand) {
	const timeDifference = { time: 0 };
	if (await profile.isCooldownActive(interaction.user.id, `chest_${subcommand}`, timeDifference)) {
		await interaction.reply({ content: `Por favor, espera ${utils.formatTimeMilliseconds(timeDifference.time)} antes de intentarlo de nuevo.`,
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	const rewards = getRewards(subcommand);
	await profile.savePoints(interaction.user.id, rewards.manaOrbes, rewards.chestKeys || 0, `chest_${subcommand}`, chest[subcommand].waitMs);

	const embed = new EmbedBuilder()
		.setTitle(`Abriendo el cofre ${subcommand}`)
		.setColor(chest[subcommand].color)
		.setThumbnail(chest[subcommand].image)
		.setDescription(`¡Felicidades! Has abierto un cofre ${subcommand} y has recibido tus recompensas.\n\n- ${toStringRewards(rewards).join("\n- ")}\n\n-# Próximo cofre en ${chest[subcommand].wait}.`);
	await interaction.reply({ embeds: [embed] });
}

module.exports = {
	openChestCommand
};