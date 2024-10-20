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

const { Collection } = require('discord.js')
const path = require('path');
const fs = require('fs');

//
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//

function getCommandsCollection() {
    const commandsPath = path.join(__dirname, './commands');
    let commands = new Collection()
    fs.readdirSync(commandsPath)
        .filter(file => file.endsWith('.js')/* && !file.startsWith('_')*/)
        .forEach(file => {
            const command = require(path.join(commandsPath, file));
            commands.set(command.data.name, command);
        });
    return commands
}

function getEventsCollection() {
    const eventsPath = path.join(__dirname, './events');
    return fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'))
        .map(file => require(path.join(eventsPath, file)))
}

module.exports = {
    getCommandsCollection,
    getEventsCollection
}