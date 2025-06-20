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

const { Message, EmbedBuilder, Collection, GuildMember } = require("discord.js");
const { Db } = require("mongodb");
const topLimits = require("../../../.botconfig/top-limits.json")

const STAR_ROLE_ID = '1302401396133466246'
const PROBOT_USER_ID = '282859044593598464'

/**
 * Roles of users who should not be assigned the role
 */
const roleIdsToCheck = [
    '1119804656923709512', // Dictador
    '1119804806521946155', // Tribunal supremo
    '1121221914254397592', // Ministerio
    '1216132476674773142'  // Notable
];

/**
 * @param {string[]} blMembers 
 * @param {GuildMember} member
 * @returns {boolean} 
 */
function isRoleAssignable(blMembers, member) {
    if (!member || !member.roles?.cache)
        return false;
    return !roleIdsToCheck.some(roleId => member.roles.cache.has(roleId)) && !blMembers.includes(member.id);
}

/**
 * Returns the list of members (ID) within the blacklist
 * 
 * @param {Db} database 
 * @returns {string[]}
 */
async function getBlacklistMembers(database) {
	const config = await database.collection('config').findOne(
		{ type: 'top_xp' },
		{
			projection: 
			{ 
				blacklist: 1, 
				_id: 0 
			}
		}
	);

	return config ? config.blacklist : [];
}

/**
 * Users who have been assigned server staff roles or notable roles should have
 * their 'Stars' role removed as that is the policy.
 * 
 * @param {Collection<string, GuildMember>} guildMembers
 * @param {GuildMember} _message
 * @param {string[]?} usersException 
 * @returns {Promise<number>} number of roles removed
 */
async function debugUserRoles(guildMembers, _message, usersException) {
    const members = guildMembers.filter(member => member.roles.cache.has(STAR_ROLE_ID))

    let rolesRemoved = 0
    for (let i = 0; i < members.size; i++) {
        if (roleIdsToCheck.some(roleId => members.at(i).roles.cache.has(roleId))) {
            if (!usersException.some(value => value === members.at(i).id)) {
                await members.at(i).roles.remove(STAR_ROLE_ID, 'Removed the user\'s role for being Staff or Notable')
                rolesRemoved++
            }
        }
    }

    return rolesRemoved
}

/**
 * @param {string[]} blMembers 
 * @param {Message} _message 
 * @param {Collection<string, GuildMember>} guildMembers 
 * @param {Collection<string, Message<boolean>>} messages
 * @returns {{ id: string, position: number, assigned: boolean, xp: number }[]}
 */
function getProBotTopUsers(blMembers, guildMembers, _message, messages) {
    const result = messages.filter(message => message.author.bot && message.author.id === PROBOT_USER_ID);
    if (result.size === 0) {
        throw new Error('No messages found for ProBot');
    }

    const users = new Map();

    result.forEach(message => {
        if (message.embeds.length === 1 && message.embeds[0].author.name.indexOf('Guild Score Leaderboards') !== -1
            && message.embeds[0].title.indexOf('TEXT SCORE') != -1) {
            message.embeds[0].description.split('\n').forEach(part => {
                if (!part.startsWith('**')) {
                    // line syntax #1 I <@!000000000000000> XP: `00000`\n
                    const userId = part.substring(part.indexOf('<@!') + '<@!'.length, part.indexOf('>'));
                    const member = guildMembers.get(userId);
                    if (isRoleAssignable(blMembers, member) && !users.has(userId)) {
                        users.set(userId, {
                            id: userId,
                            position: parseInt(part.substring(part.indexOf('#') + '#'.length, part.indexOf('I')).trim()),
                            xp: parseInt(part.substring(part.indexOf(':') + ':'.length).trim().replace('`', '')),
                            assigned: false
                        });
                    }
                }
            });
        }
    });

    // Convert the map to an array and sort
    return Array.from(users.values()).sort((a, b) => a.position - b.position);
}

/**
 * Users who are not in the top are removed from the role
 * 
 * @param {Collection<string, GuildMember>} guildMembers
 * @param {{ id: string, position: number, assigned: boolean }[]} users 
 * @param {Message} _message
 * @param {string[]?} usersException 
 * @returns {Promise<number>} number of roles removed
 */
async function removeInvalidRolesFromUsers(guildMembers, users, _message, usersException) {
    let invalidRoles = 0;
    const membersWithStarRole = guildMembers.filter(member => member.roles.cache.has(STAR_ROLE_ID));
    for (const member of membersWithStarRole.values()) {
        if (users.findIndex(user => user.id === member.id) === -1) {
            if (!usersException.some(value => value === member.id)) {
                await member.roles.remove(STAR_ROLE_ID, `It has dropped out of the top ${topLimits.positions} or ${topLimits.limit}`);
                invalidRoles++;
            }
        }
    }

    return invalidRoles;
}


/**
 * 
 * @param {Db} database 
 * @param {Message} message
 * @param {{ id: string, position: number, assigned: boolean, xp: number }[]} users 
 * @returns {Promise<boolean>} 
 */
async function saveUsersListXP(database, message, users) {
    try {
        const top_xp = await database.collection('config').findOne(
            {
                type: 'top_xp'
            });

        let result;
        if (!top_xp) {
            result = await database.collection('config').insertOne(
                {
                    type: 'top_xp',
                    usersList: users
                });
        } else {
            result = await database.collection('config').updateOne(
                { _id: top_xp._id },
                {
                    $set: {
                        usersList: users
                    }
                });
        }

        if (!result.acknowledged)
            throw new Error('Failed to save the list of users')
    } catch (e) {
        console.error(e)
        message.reply(`Error: ${e.message}`)
        return false
    }
    return true
}

/**
 * @param {Db} database 
 * @param {Message} message 
 * @param {string[]} parameters 
 */
async function scan(database, message, parameters) {
    try {
        if (!message.guild)
            return
        await message.guild.members.fetch();
        const guildMembers = message.guild.members.cache;
        const blacklist = getBlacklistMembers(database)

        const users = getProBotTopUsers(blacklist, guildMembers, message, await message.channel.messages.fetch({
            limit: parameters.length >= 1 ? parseInt(parameters[0]) + 1 : 5
        }))

        if (users.length === 0)
            return message.reply('An error has occurred, report it to zuka :)')
        if (users.length < topLimits.limit)
            return message.reply(`${users.length} users have been found, ${topLimits.limit - users.length} user(s) are missing. Insert another page`)

        users.splice(topLimits.limit)
        if (!await saveUsersListXP(database, message, users))
            return

        const rolesRemoved = await debugUserRoles(guildMembers, message, topLimits.usersException)
        const InvalidRoles = await removeInvalidRolesFromUsers(guildMembers, users, message, topLimits.usersException)

        let addedRoles = 0

        for (let i = 0; i < topLimits.positions; i++) {
            const member = guildMembers.get(users[i].id)
            if (member) {
                if (!member.roles.cache.has(STAR_ROLE_ID)) {
                    await member.roles.add(STAR_ROLE_ID, 'Role assigned for being active');
                    addedRoles++
                }
            }
        }

        await message.reply(`Users scan completed!\n- Users (Staff/Notable) rol removed: ${rolesRemoved}\n- Number of users who left the Top ${topLimits.limit}: ${InvalidRoles}\n- Number of users who entered the Top ${topLimits.positions}: ${addedRoles}`)
    } catch (e) {
        console.error(e)
        try {
            message.reply(`Error: ${e.message}`)
        } catch (err) {

        }
    }
}

module.exports = {
    scan
}