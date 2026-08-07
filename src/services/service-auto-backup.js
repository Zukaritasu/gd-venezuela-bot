/**
 * Copyright (C) 2026 Zukaritasu
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

const { Client } = require("discord.js");
const { Db } = require("mongodb");
const logger = require("../logger");
const fs = require('fs');
const path = require('path');
const { COLL_CONFIG, COLL_USERS_ACTIVITY } = require("../../.botconfig/database-info.json");

const LAST_UPDATE_KEY = 'lastUsersActivityBackup';

/**
 * Starts the automatic backup service for user activity data
 * @param {Db} db - The MongoDB database instance
 * @param {Client} client - The Discord.js client instance
 * @returns {Promise<{stop: function, description: string, name: string, fullname: string}>} - An object containing a stop function and service metadata
 * @throws Will throw an error if the backup process fails
 * @example
 * const service = await require('./service-auto-backup').start(database, client);
 */
async function service(db, client) {
	const backupDir = path.join(__dirname, '../../backups');

	const functionRun = async () => {
		try {
			const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

			const updateResult = await db.collection(COLL_CONFIG).findOneAndUpdate(
				{
					type: LAST_UPDATE_KEY,
					$or: [
						{ time: { $exists: false } },
						{ time: { $lte: tenDaysAgo } }
					]
				},
				{ $set: { time: new Date() } },
				{ upsert: true, returnDocument: 'after' }
			);

			if (!(updateResult.value || !updateResult.lastErrorObject?.updatedExisting)) {
				return;
			}

			await fs.promises.mkdir(backupDir, { recursive: true });

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const backupFilePath = path.join(backupDir, `users_activity_backup_${timestamp}.json`);

			const cursor = db.collection(COLL_USERS_ACTIVITY).find().stream();
			const writeStream = fs.createWriteStream(backupFilePath, { encoding: 'utf-8' });

			writeStream.write('[\n');
			let isFirst = true;

			for await (const doc of cursor) {
				if (!isFirst) {
					writeStream.write(',\n');
				}
				writeStream.write(JSON.stringify(doc));
				isFirst = false;
			}
			writeStream.write('\n]');
			writeStream.end();

			logger.INF(`Backup of ${COLL_USERS_ACTIVITY} completed successfully. File saved at: ${backupFilePath}`);
		} catch (error) {
			logger.ERR(error);
		}
	}

	await functionRun();

	const timeout = setInterval(functionRun, /* 1 hour */ 1 * 60 * 60 * 1000);

	return {
		stop: () => clearInterval(timeout),

		description: 'This service automatically backs up the user activity data from the database every 10 days to a local file in the backups directory.',
		name: 'service-auto-backup',
		fullname: 'Automatic Collection Backup Service'
	}
}

module.exports = {
	start: service
}