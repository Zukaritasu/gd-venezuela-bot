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
const { exit } = require('process');
const logger = require('./src/logger')
const botenv = require('./src/botenv');
const { TIMEZONEDB_API_KEY } = require('./.botconfig/token.json')

/* const fetch = require('node-fetch'); */

/////////////////////////////////////////////////
// Main bot launcher
/////////////////////////////////////////////////

const HASHLIST_FILENAME = './hashlist.json';

process.chdir(__dirname);

const RETRYABLE_STATUS_CODES = [
    408, // Request Timeout
    429, // Too Many Requests (Rate Limit)
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504  // Gateway Timeout
]

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const RETRY_INTERVAL_MS = 3000;
const MAX_ALLOWED_DIFFERENCE_MS = 10000;

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
 * Execute a JS file in a subprocess (asynchronously)
 * @param {string} command - The command/file path to execute
 * @returns {Promise<boolean>} - true if the command executed successfully, false otherwise
 */
async function executeSubprocess(command) {
    return new Promise((resolve) => {
        const child = fork(command);

        child.on('exit', (code) => {
            const success = code === 0;
            if (!success) {
                logger.ERR(`Subprocess terminated with error code ${code}`);
            } else {
                logger.INF(`Subprocess terminated with code 0`);
            }
            resolve(success);
        });

        child.on('error', (error) => {
            logger.ERR(`Subprocess failed to start or encountered an internal error: ${error.message}`);
            resolve(false);
        });

        child.on('message', (message) => {
            console.log(`[SUBPROCESS MESSAGE]: ${message}`);
        });
    });
}

/** 
 * Verify system clock integrity by comparing with a trusted time source
 * @returns {Promise<boolean>} - true if the system clock is in sync, false otherwise
 */
async function verifyClockIntegrity() {
    const fetchReliably = async () => {
        while (true) {
            try {
                const response = await fetch(
                    `https://api.timezonedb.com/v2.1/get-time-zone?key=${TIMEZONEDB_API_KEY}&format=json&by=zone&zone=Etc/UTC`, 
                    { timeout: 5000 });
                if (response.ok) return response;
                if (!RETRYABLE_STATUS_CODES.includes(response.status))
                    throw new Error(`Non-retryable HTTP status: ${response.status}`);
            } catch (error) {
                logger.ERR(`Error fetching time: ${JSON.stringify(details)}`);
                return null;
            }

            await sleep(RETRY_INTERVAL_MS);
        }
    };

    try {
        const response = await fetchReliably();
        if (!response)
            return false
        const data = await response.json();
        const timeDifference = Math.abs((data.timestamp * 1000) - Date.now());

        if (timeDifference > MAX_ALLOWED_DIFFERENCE_MS)
            throw new Error(`Clock out of sync by: ${timeDifference / 1000}s.`);
        return true;
    } catch (error) {
        logger.ERR(error);
        return false;
    }
}

/////////////////////////////////////////////////
// Main
/////////////////////////////////////////////////

logger.INF('*'.repeat(50))
logger.INF('Starting bot...')

const commands = botenv.getAbsolutePathCommands()

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

const deployCommands = async () => {
    writeHashlistFile();
    if (!(await executeSubprocess('./src/deploy-commands.js'))) {
        exit(1);
    }
};



(async () => {
    if (!(await verifyClockIntegrity()))
        exit(1)

    if (commands.length !== 0) {
        try {
            if (!fs.existsSync(HASHLIST_FILENAME)) {
                await deployCommands()
            } else {
                const hashlist = require(HASHLIST_FILENAME)
                if (hashlist.length !== commands.length) {
                    await deployCommands()
                } else {
                    for (let i = 0; i < commands.length; i++) {
                        const data = hashlist.find(data => data.name === commands[i].name)
                        if (data === undefined || generateSHA256(commands[i].absolutePath) !== data.hash) {
                            await deployCommands()
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
        await executeSubprocess('./src/bot.js')
        await sleep(5000)
    }
})()
