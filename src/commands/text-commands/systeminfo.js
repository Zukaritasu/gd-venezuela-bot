/**
 * Copyright (C) 2026 Zukaritasu
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

const os = require('os');
const { Message, EmbedBuilder } = require('discord.js');
const logger = require('../../logger')

/**
 * Send system status. CPU, free memory and this process memory
 * 
 * @param {Message} message 
 */
async function sendSystemStatus(message) {
	try {
		const totalMemory = os.totalmem();
		const freeMemory = os.freemem();
		const usedMemory = totalMemory - freeMemory;
		const cpuInfo = os.cpus();
		const processMemory = process.memoryUsage();
		const uptimeSeconds = os.uptime();
		const loadAverage = os.loadavg();

		const formatBytes = (bytes) => {
			if (bytes === 0) return '0 B';

			const units = ['B', 'KB', 'MB', 'GB', 'TB'];
			let value = bytes;
			let unitIndex = 0;

			while (value >= 1024 && unitIndex < units.length - 1) {
				value /= 1024;
				unitIndex++;
			}

			return `${value.toFixed(2)} ${units[unitIndex]}`;
		};

		const formatUptime = (seconds) => {
			const days = Math.floor(seconds / 86400);
			const hours = Math.floor((seconds % 86400) / 3600);
			const minutes = Math.floor((seconds % 3600) / 60);
			return `${days}d ${hours}h ${minutes}m`;
		};

		const embed = new EmbedBuilder()
			.setTitle('Server Status')
			.setDescription('Information about the VPS where the bot is running')
			.addFields(
				{
					name: 'System',
					value: `${os.platform()} ${os.release()}`,
					inline: true,
				},
				{
					name: 'Hostname',
					value: os.hostname(),
					inline: true,
				},
				{
					name: 'Architecture',
					value: process.arch,
					inline: true,
				},
				{
					name: 'CPU',
					value: cpuInfo[0]?.model || 'Unavailable',
					inline: true,
				},
				{
					name: 'Cores',
					value: `${cpuInfo.length}`,
					inline: true,
				},
				{
					name: 'Memory used',
					value: `${formatBytes(usedMemory)} / ${formatBytes(totalMemory)} (${((usedMemory / totalMemory) * 100).toFixed(1)}%)`,
					inline: true,
				},
				{
					name: 'Free memory',
					value: formatBytes(freeMemory),
					inline: true,
				},
				{
					name: 'Process memory',
					value: `RSS ${formatBytes(processMemory.rss)} | Heap ${formatBytes(processMemory.heapUsed)} / ${formatBytes(processMemory.heapTotal)}`,
					inline: true,
				},
				{
					name: 'Average load',
					value: loadAverage.map(value => value.toFixed(2)).join(' / '),
					inline: true,
				},
				{
					name: 'Uptime',
					value: formatUptime(uptimeSeconds),
					inline: true,
				}
			)
			.setTimestamp();

		await message.reply({ embeds: [embed] });
	} catch (e) {
		logger.ERR(e)
	}
}

module.exports = {
    sendSystemStatus,
}