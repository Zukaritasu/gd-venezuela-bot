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

const { SlashCommandBuilder } = require("discord.js");

/**
 * Executes the appropriate game command based on the subcommand and subcommand group.
 * @param {import("discord.js").Client} _client - The Discord client instance
 * @param {import("mongodb").Db} _db - The MongoDB database instance
 * @param {import("discord.js").ChatInputCommandInteraction} interaction - The command interaction object
 */
async function execute(_client, _db, interaction) {
	const subcommandGroup = interaction.options.getSubcommandGroup();
	const subcommand = interaction.options.getSubcommand();

	if (subcommandGroup) {
		if (subcommandGroup === 'open-chest') {
			await require('./games/open-chest').openChestCommand(interaction, subcommand);
		} else if (subcommandGroup === 'demon-boss') {
			await require('./games/demon-boss').demonBossCommand(interaction, subcommand);
		}
		return
	}

	if (subcommand === 'slot-machine') {
		await require('./games/collection/slot-machine').slotMachineCommand(interaction);
	} else if (subcommand === 'profile') {
		await require('./games/profile').profileCommand(interaction);
	} else if (subcommand === 'tienda') {
		await require('./games/tienda').tiendaCommand(interaction);
	}
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('game')
        .setDescription('Juegos disponibles')
		.addSubcommand(subcommand =>
			subcommand
				.setName('slot-machine')
				.setDescription('Juega a la máquina tragaperra')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('profile')
				.setDescription('Mira tu perfil de jugador')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('tienda')
				.setDescription('Mira la tienda de recompensas')
		)
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName('open-chest')
				.setDescription('Abre un cofre para obtener recompensas')
				.addSubcommand(subcommand =>
					subcommand
						.setName('small')
						.setDescription('Abre un cofre cada 3 horas')
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName('daily')
						.setDescription('Abre un cofre cada 24 horas')
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName('weekly')
						.setDescription('Abre un cofre cada 7 días')
				)
		)
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName('demon-boss')
				.setDescription('Lucha contra el Demon para obtener recompensas')
				.addSubcommand(subcommand =>
					subcommand
						.setName('actual')
						.setDescription('Demon semanal actual')
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName('saltar')
						.setDescription('Salta para derrotar al Demon actual')
				)
		),
    execute
};