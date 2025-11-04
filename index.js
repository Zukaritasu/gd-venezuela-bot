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

const { fork } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { exit } = require('process');
const logger = require('./src/logger')
const botenv = require('./src/botenv')
const fetch = require('node-fetch');

/////////////////////////////////////////////////
// Main bot launcher
/////////////////////////////////////////////////

const HASHLIST_FILENAME = './hashlist.json';

process.chdir(__dirname);

/////////////////////////////////////////////////
// Functions
/////////////////////////////////////////////////

/**
 * Generate SHA256 hash of a file
 * @param {string} filePath - The path to the file
 * @returns {string} - The SHA256 hash of the file
 */
function generateSHA256(filePath) {
    return crypto.createHash('sha256').update(JSON.stringify(require(filePath))).digest('hex')
}

/**
 * Execute a JS file synchronously in a subprocess
 * @param {string} command - The command to execute
 * @returns {Promise<boolean>} - true if the command executed successfully, false otherwise
 */
async function execJSFileSynch(command) {
    return !(await new Promise((resolve, reject) => {
        fork(command).on('exit', (code) => {
            if (code != 0)
                logger.ERR(`Subprocess is terminated with code ${code}`)
            else
                logger.INF(`Subprocess is terminated with code 0`)
            resolve(code != 0)
        }).on('error', (error) => {
            reject(true)
            console.log(`${error}`);
        }).on('message', (message) => {
            console.log(`${message}`);
        })
    }))
}

/** 
 * Verify system clock integrity by comparing with a trusted time source
 * @returns {Promise<boolean>} - true if the system clock is in sync, false otherwise
 */
async function verifyClockIntegrity() {
    try {
        const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC');
        if (!response.ok) {
            throw new Error(`Failed to fetch time from trusted source: ${response.statusText}`);
        }
        const data = await response.json();
        const trustedTime = new Date(data.utc_datetime);
        const localTime = new Date();

        const timeDifference = Math.abs(trustedTime - localTime);
        const maxAllowedDifference = 10000; // 10 seconds

        if (timeDifference > maxAllowedDifference) {
            logger.ERR(`System clock is out of sync by more than 10 seconds. Difference: ${timeDifference / 1000} seconds.`);
            return false;
        }
    } catch (error) {
        logger.ERR(error);
        return false;
    }

    return true;
}

///////////////////////////////////////////////////
// Main
/////////////////////////////////////////////////

logger.INF('*'.repeat(50))
logger.INF('Starting bot...')

let commands = botenv.getAbsolutePathCommands()

const writeHashlistFile = () => {
    let new_haslist = []
    commands.forEach(command => new_haslist.push(
        {
            name: command.name,
            hash: generateSHA256(command.absolutePath)
        }
    ))

    fs.writeFileSync(HASHLIST_FILENAME, JSON.stringify(new_haslist, null, 2))
}

(async () => {
    if (!(await verifyClockIntegrity())) 
        exit(1)

    if (commands.length !== 0) {
        try {
            if (!fs.existsSync(HASHLIST_FILENAME)) {
                writeHashlistFile()
                if (!(await execJSFileSynch('./src/deploy-commands.js')))
                    exit(1)
            } else {
                const hashlist = require(HASHLIST_FILENAME)
                if (hashlist.length !== commands.length) {
                    writeHashlistFile()
                    if (!(await execJSFileSynch('./src/deploy-commands.js')))
                        exit(1)
                } else {
                    for (let i = 0; i < commands.length; i++) {
                        const data = hashlist.find(data => data.name === commands[i].name)
                        if (data === undefined || generateSHA256(commands[i].absolutePath) !== data.hash) {
                            writeHashlistFile()
                            if (!(await execJSFileSynch('./src/deploy-commands.js')))
                                exit(1)
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            logger.ERR(error)
            exit(1)
        }
    }

    while (true) {
        await execJSFileSynch('./src/bot.js')
        setTimeout(() => { }, 5000);
    }
})()
