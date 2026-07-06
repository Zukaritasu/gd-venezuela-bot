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

async function execute(_client, _db, interaction) {
	const subcommand = interaction.options.getSubcommand();

	if (subcommand === 'slot-machine') {
		await require('./games/collection/slot-machine').slotMachineCommand(interaction);
	}
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('game')
        .setDescription('Juegos disponibles en el bot')
		.addSubcommand(subcommand =>
			subcommand
				.setName('slot-machine')
				.setDescription('Juega a la máquina tragamonedas')
		),
    execute,
};