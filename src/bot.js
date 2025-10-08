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

const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const botenv = require('./botenv')
const { TOKEN, URI_DATABASE } = require('../.botconfig/token.json');
const { Db, MongoClient } = require('mongodb');
const redis = require('redis')
const logger = require('./logger')
const { DATABASE_NAME } = require('../.botconfig/database-info.json');

//
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//

process.chdir(__dirname);


(async () => {
    /** @type Db */
	let database = null

	try {
		database = (await (mongodb = new MongoClient(URI_DATABASE)).connect())
			.db(DATABASE_NAME)
        logger.INF('Database connection successful!');
	} catch (e) {
        logger.ERR(e)
		return
	}

    // Modules are loaded to define the redis object

    const modules = [ './apipcrate', './aredlapi', './robtopapi' ]
    const redisClient = redis.createClient()

    try {
        await redisClient.connect();
        logger.INF('Redis client connected')
        
        modules.forEach(module => require(module).setRedisClientObject(redisClient))
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

