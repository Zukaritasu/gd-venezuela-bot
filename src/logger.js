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

const fs = require('fs');
const path = require('path');
const moment = require('moment');

const offset = -4; // UTC offset for Venezuela Time (VET) is -4 hours


const dbgStream = fs.createWriteStream(path.join(__dirname, '..', '/log/service_dbg.log'), { flags: 'a' });

function log(level, logFunction, args) {
  const localTime = moment().utcOffset(offset);
  logFunction(`[${level}][${localTime.format('YYYY.MM.DD - HH:mm:ss.SSS')}] ${args.join(' ')}`);
}

function INF(...args) {
  log('INF', console.log, args);
}

function WAR(...args) {
  log('WAR', console.log, args);
}

function ERR(...args) {
    const formatted = args.map(arg => {
        if (arg instanceof Error) {
            return [
                `${arg.name}: ${arg.message}`,
                ...arg.stack?.split('\n').slice(1).map(line => `    at ${line.trim()}`)
            ].join('\n');
        }
        return arg;
    });

    log('ERR', console.error, formatted);
}

function DBG(...args) {
  log('DBG', (...args_dbg) => {
    dbgStream.write(`${args_dbg.join(' ')}\n`, (err) => {
      if (err) {
        ERR('Error writing to service_dbg.log:', err);
      }
    });
  }, args);
}

module.exports = {
  INF,
  WAR,
  ERR,
  DBG
};