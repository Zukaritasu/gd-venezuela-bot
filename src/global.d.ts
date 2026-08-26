import { Guild } from 'discord.js';
import { Db } from 'mongodb'
import { createClient } from 'redis'

declare global {
  var guild: Guild | undefined;
  var database: Db;
  var redisClient: ReturnType<typeof createClient> | undefined;
}

export {};