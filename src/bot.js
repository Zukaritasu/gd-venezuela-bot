/**
 * Copyright (C) 2024 Zukaritasu
 * 
 * This program is free software: you can redistribute it and/or modify
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

require('dotenv').config();

const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const botenv = require('./botenv')
const { TOKEN, URI_DATABASE } = require('../.botconfig/token.json');
const { Db, MongoClient } = require('mongodb');
const redis = require('redis')
const logger = require('./logger')
const { DATABASE_NAME } = require('../.botconfig/database-info.json');

process.chdir(__dirname);


(async () => {
    /** @type {Db} */
    let database = null

    try {
        const mongodb = new MongoClient(URI_DATABASE)

        database = (await mongodb.connect()).db(DATABASE_NAME)
        global.database = database

        logger.INF('Database connection successful!');
    } catch (e) {
        logger.ERR(e)
        return
    }

    const redisClient = redis.createClient({
        socket: {
            keepAlive: 10000,
            reconnectStrategy: (retries) => {
                return Math.min(retries * 100, 3000);
            }
        },
        pingInterval: 10000,
        disableOfflineQueue: true
    })

    redisClient.on('error', (error) => { logger.INF('[REDIS]', error); });
    redisClient.on('connect', () => { logger.INF('[REDIS] Connecting...'); });
    redisClient.on('reconnecting', () => { logger.INF('[REDIS] Reconnecting...'); });
    redisClient.on('ready', () => { logger.INF('[REDIS] Client connected!'); });

    try {
        await redisClient.connect();
        global.redisClient = redisClient

        // Modules are loaded to define the redis object
        const modules = [
            './apis/apipcrate',
            './apis/aredlapi',
            './apis/robtopapi',
            './apis/gdvzlalistapi',
            './commands/text-commands/save-hashes'
        ]

        modules.forEach(module => require(module).setRedisClientObject(redisClient))

        // Initialize activity module with Redis
        await require('./commands/leveling/activity').initializeActivityLog()
    } catch (e) {
        logger.ERR(e)
        return
    }

    // The bot client instance is created

    const client = new Client({
        intents:
            [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildVoiceStates,
            ],
        partials: [
            'CHANNEL'
        ],
        presence: {
            activities: [
                {
                    name: 'Geometry Dash',
                    type: ActivityType.Playing
                }
            ]
        }
    });

    client.commands = botenv.getCommandsCollection();

    // Loading of bot event modules
    botenv.getEventsCollection().forEach(event => {
        const eventFunc = (...args) => event.execute(client, database, ...args)
        if (event.once) {
            client.once(event.name, eventFunc);
        } else {
            client.on(event.name, eventFunc);
        }
    })

    client.login(TOKEN).catch((error) => {
        logger.ERR(error)
    }).then(() => {
        logger.INF('successfully logged!')
    });
})()

