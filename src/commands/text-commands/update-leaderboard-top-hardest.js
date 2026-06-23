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

const GITHUB_TOKEN = require('../../../.botconfig/token.json').GITHUB_TOKEN;
const { flags } = require('../../../.botconfig/flags.json')
const { COLL_GDVZLA_LIST_PROFILES, COLL_CACHE_LEVELS_IMG_16x5 } = require('../../../.botconfig/database-info.json')
const { Db } = require('mongodb');
const channels = require('../../../.botconfig/channels.json');
const axios = require('axios');
const webp = require('webp-wasm');
const path = require('node:path')

const Canvas = require('canvas');
const StackBlur = require('stackblur-canvas');
const logger = require('../../logger');
const aredlapi = require('../../aredlapi');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

function getLevelNormalizedName(levelName) {
    return levelName.toLowerCase().replaceAll(' ', '_').replaceAll('(', '').replaceAll(')', '');
}

async function loadWebPImage(url) {
    await webp.load();

    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    const imageData = await webp.decode(buffer);

    const canvas = Canvas.createCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');

    const imgData = Canvas.createImageData(imageData.data, imageData.width, imageData.height);
    ctx.putImageData(imgData, 0, 0);

    return canvas;
}

async function cropImageToRatio(url, outputWidth = 1600, outputHeight = 500) {
    const originalCanvas = await loadWebPImage(url);
    const originalWidth = originalCanvas.width;
    const originalHeight = originalCanvas.height;

    const targetRatio = outputWidth / outputHeight;
    const sourceRatio = originalWidth / originalHeight;

    let cropWidth = originalWidth;
    let cropHeight = originalHeight;
    let cropX = 0;
    let cropY = 0;

    if (sourceRatio > targetRatio) {
        cropHeight = originalHeight;
        cropWidth = originalHeight * targetRatio;
        cropX = (originalWidth - cropWidth) / 2;
    } else {
        cropWidth = originalWidth;
        cropHeight = originalWidth / targetRatio;
        cropY = (originalHeight - cropHeight) / 2;
    }

    const croppedCanvas = Canvas.createCanvas(outputWidth, outputHeight);
    const ctx = croppedCanvas.getContext('2d');

    ctx.drawImage(
        originalCanvas,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        outputWidth,
        outputHeight
    );

    return croppedCanvas;
}

async function uploadCroppedLevelImage(client, levelId) {
    const channel = await client.channels.fetch(channels.BOT_TESTING);

    if (!channel?.isTextBased()) {
        throw new Error('No se pudo obtener el canal de pruebas para subir la imagen.');
    }

    const imageUrl = `https://raw.githubusercontent.com/All-Rated-Extreme-Demon-List/Thumbnails/main/levels/full/${levelId}.webp`;
    const croppedCanvas = await cropImageToRatio(imageUrl, 1600, 500);

    const attachment = new AttachmentBuilder(croppedCanvas.toBuffer(), {
        name: `level-${levelId}-16-5.png`
    });

    const sentMessage = await channel.send({ files: [attachment] });
    const uploadedUrl = sentMessage.attachments.first()?.url;

    if (!uploadedUrl) {
        throw new Error(`No se pudo obtener la URL de la imagen subida para el level ${levelId}`);
    }

    return uploadedUrl;
}

/**
 * 
 * @param {Db} db 
 * @returns 
 */
async function getTop10(db) {
    const response = await axios.get(`${process.env.URL_API_GITHUB}/public/data/_list.json`, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`
        }
    });

    /** @type {string[]>} */
    let levels = JSON.parse(Buffer.from(response.data.content, "base64").toString())

    if (!Array.isArray(levels)) {
        throw new Error('Invalid data format');
    }

    const profiles = await db.collection(COLL_GDVZLA_LIST_PROFILES).find().toArray()
    const allRatedLevels = await aredlapi.getLevels()

    levels = levels.slice(0, 10);

    /** @type {{ name: string, position: number, level_id: number, usernames: { username: string, video: string, userId: string, flag: string }[] }[]} */
    const top10 = []

    for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        const levelResponse = await axios.get(`${process.env.URL_API_GITHUB}/public/data/${level}.json`, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`
            }
        });

        const levelData = JSON.parse(Buffer.from(levelResponse.data.content, "base64").toString());

        if (!levelData) {
            throw new Error(`Invalid level data for ${level}`);
        }

        const index = allRatedLevels.findIndex(l => getLevelNormalizedName(l.name) === level)
        if (index === -1) {
            continue
        }

        const topLevel = {
            name: levelData.name,
            position: index + 1,
            level_id: allRatedLevels[index].level_id,
            usernames: [
                {
                    username: levelData.verifier,
                    video: levelData.verification,
                    userId: profiles.find(p => p.username === levelData.verifier)?.userId,
                    flag: flags.find(f => f.indexOf(path.parse(levelData.flag).name.replace('-', '')) !== -1)
                },
                ...levelData.records.map(record => {
                    return {
                        username: record.user,
                        video: record.link,
                        userId: profiles.find(p => p.username === record.user)?.userId,
                        flag: flags.find(f => f.indexOf(path.parse(record.flag).name.replace('-', '')) !== -1)
                    }
                })
            ]
        }

        top10.push(topLevel);
    }

    return top10
}

async function cleanChannel(channel) {
    const fetched = await channel.messages.fetch({ limit: 100 });
    if (fetched.size > 0) {
        for (let i = fetched.size - 1; i >= 0; i--) {
            await fetched.at(i).delete().catch(logger.ERR);
        }
    }
}

/**
 * @param {Db} db 
 * @param {import('discord.js').Message} message
 * @returns {Promise<void>}
 */
async function update(db, message) {
    const channel = await message.guild.channels.fetch(channels.TOP_HARDEST)

    if (!channel) {
        return await message.reply('Channel not found')
    }

    const top10 = await getTop10(db)

    /** @type {{ url: string, level_id: number }[]} */
    const cacheImgs = await db.collection(COLL_CACHE_LEVELS_IMG_16x5).find().toArray()

    await cleanChannel(channel)

    const embeds = []

    for (let i = 0; i < top10.length; i++) {
        const embed = new EmbedBuilder();
        let imageUrl = cacheImgs.find(img => img.level_id === top10[i].level_id)?.url

        if (!imageUrl) {
            imageUrl = await uploadCroppedLevelImage(message.client, top10[i].level_id);
            await db.collection(COLL_CACHE_LEVELS_IMG_16x5).insertOne(
                {
                    url: imageUrl,
                    level_id: top10[i].level_id
                }
            )
        }
        
        embed.setTitle(`${i + 1} ${top10[i].name} (Top #${top10[i].position})`)
        embed.setDescription(`- ${top10[i].usernames.map(user => `${user.flag} ${user.username} [video](${user.video})`).join('\n- ')}`)
        embed.setImage(imageUrl)

        switch (true) {
            case (i >= 0 && i <= 2):
                embed.setColor(0xFFDF20);
                break;
            case (i >= 3 && i <= 6):
                embed.setColor(0x155DFC);
                break;
            default:
                embed.setColor(0xE7180B);
                break;
        }

        embeds.push(embed)
    }

    await channel.send({
        content: '<:zTrophy:1215845799313932400> Top Niveles **más difíciles** de la @Demonlist Venezuela <:flag_Ven:1120424330879320124>\n\nPara ver la lista completa del Top 150, visita nuestro sitio web [GD Venezuela List](https://gdvzla.pages.dev/#/). Si estás interesado en enviar un récord, dirígete al canal <#1368411272965525684>.',
        embeds
    })

    await message.react('✅')
}

module.exports = { update }