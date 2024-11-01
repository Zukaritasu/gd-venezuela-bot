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

const { SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');


//
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//

/**
 * 
 * @param {*} client 
 * @param {*} database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(client, database, interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === 'jugador') {
        if (subcommand === 'cp') {
            await require('./staff/save-cp-player').execute(client, database, interaction)
        }
    } else if (subcommandGroup === 'estado') {
        if (subcommand === 'hardest') {
            await require('./staff/set-state-hardest').execute(client, database, interaction)
        }
    }

    else if (subcommand === 'hardest') {
        await require('./staff/set-hardest').execute(client, database, interaction)
    } else if (subcommand === 'info') {
        await require('./staff/info').execute(client, database, interaction)
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff')
        .setDescription('Comandos de uso exclusivo para el Staff del servidor.')
        .addSubcommandGroup(subCommandGroup =>
            subCommandGroup.setName('jugador')
                .setDescription('Configurar un jugador')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('cp')
                        .setDescription('Guarda un jugador con puntos de creador (solo personal autorizado)')
                        .addUserOption(option =>
                            option.setName('user')
                                .setDescription('Seleccione el jugador')
                                .setRequired(true))
                        .addStringOption(option =>
                            option.setName('player')
                                .setDescription('Nombre del jugador en Geometry Dash')
                                .setRequired(true)))
        )
        .addSubcommandGroup(subCommandGroup =>
            subCommandGroup.setName('estado')
                .setDescription('Configurar un Estado del pais')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('hardest')
                        .setDescription('Nivel más difícil completado en el Estado (solo personal autorizado)')
                        .addStringOption(option =>
                            option.setName('player')
                                .setDescription('Nombre del usuario')
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option.setName('level')
                                .setDescription('Nombre del nivel')
                                .setRequired(true)
                        )
                        .addRoleOption(option =>
                            option.setName('state')
                                .setDescription('Rol del estado')
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option.setName('youtube')
                                .setDescription('Enlace del vídeo de YouTube')
                        ))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('hardest')
                .setDescription('Define el hardest del país (solo personal autorizado)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Selecciona el jugador')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('player')
                        .setDescription('Nombre del jugador')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('level')
                        .setDescription('Enlace del nivel en Pointercrate')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('ytvideo')
                        .setDescription('Enlace del video de YouTube')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('attemps')
                        .setDescription('Cantidad de intentos totales')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Información del Personal del Servidor')),

    execute,
};