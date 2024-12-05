const moment = require('moment');

function log(level, message, logFunction = console.log) {
  const offset = -4; // UTC offset for Venezuela Time (VET) is -4 hours
  const localTime = moment().utcOffset(offset);
  logFunction(`[${level}][${localTime.format('YYYY.MM.DD - HH:mm:ss.SSS')}] ${message}`);
}

function INF(message) {
  log('INF', message);
}

function WAR(message) {
  log('WAR', message);
}

function ERR(message) {
  log('ERR', message, console.error);
}

module.exports = {
  INF,
  WAR,
  ERR
};
