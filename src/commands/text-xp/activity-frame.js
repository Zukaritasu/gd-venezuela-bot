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

const { AttachmentBuilder, GuildMember } = require('discord.js');
const Canvas = require('canvas');
const StackBlur = require('stackblur-canvas');
const path = require('path');
const { Db } = require('mongodb');
const activity = require('../leveling/activity');

/**
 * @param {Db} db
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {Promise<AttachmentBuilder>} 
 */
async function getActivityFrame(db, interaction) {
    const canvas = Canvas.createCanvas(428, 112);
    const ctx = canvas.getContext('2d');

    const bgCanvas = Canvas.createCanvas(428, 112);
    const bgCtx = bgCanvas.getContext('2d');

    const avatarImage = interaction.user.avatarURL({ extension: 'png' }) || interaction.user.defaultAvatarURL;
    const avatar = await Canvas.loadImage(avatarImage);

    const userActivity = await activity.getUserActivityData(db, interaction);
    const username = interaction.user.username;
    const points = userActivity?.points || 0;
    const voicePoints = userActivity?.voicePoints || 0
    let position = userActivity?.position.toString() || '??';
    let voicePosition = userActivity?.voicePosition.toString() || '??';
    
    if (points === 0) position = '??';
    if (voicePoints === 0) voicePosition = '??';

    bgCtx.save();
    bgCtx.beginPath();
    bgCtx.roundRect(0, 0, bgCanvas.width, bgCanvas.height, 12);
    bgCtx.clip();

    const avatarAspectRatio = avatar.width / avatar.height;
    const canvasAspectRatio = canvas.width / canvas.height;
    let drawWidth, drawHeight, drawX, drawY;

    if (avatarAspectRatio > canvasAspectRatio) {
        drawHeight = canvas.height;
        drawWidth = avatar.width * (canvas.height / avatar.height);
        drawX = (canvas.width - drawWidth) / 2;
        drawY = 0;
    } else {
        drawWidth = canvas.width;
        drawHeight = avatar.height * (canvas.width / avatar.width);
        drawX = 0;
        drawY = (canvas.height - drawHeight) / 2;
    }

    bgCtx.drawImage(avatar, drawX, drawY, drawWidth, drawHeight);
    bgCtx.restore();

    StackBlur.canvasRGBA(bgCanvas, 0, 0, bgCanvas.width, bgCanvas.height, 8);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 12);
    ctx.clip();
    ctx.drawImage(bgCanvas, 0, 0);
    ctx.restore();

    const paddingRight = 16;
    const avatarRadius = 44;
    const avatarX = canvas.width - avatarRadius - paddingRight;
    const avatarY = canvas.height / 2;
    
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius - 4, 0, Math.PI * 2, true);
    ctx.clip();
    
    const avatarCircleSize = (avatarRadius - 2) * 2;
    const avatarCircleAspectRatio = avatar.width / avatar.height;
    let circleDrawWidth, circleDrawHeight, circleDrawX, circleDrawY;
    
    if (avatarCircleAspectRatio > 1) {
        circleDrawHeight = avatarCircleSize;
        circleDrawWidth = avatar.width * (avatarCircleSize / avatar.height);
        circleDrawX = avatarX - avatarRadius + 2 - (circleDrawWidth - avatarCircleSize) / 2;
        circleDrawY = avatarY - avatarRadius + 2;
    } else {
        circleDrawWidth = avatarCircleSize;
        circleDrawHeight = avatar.height * (avatarCircleSize / avatar.width);
        circleDrawX = avatarX - avatarRadius + 2;
        circleDrawY = avatarY - avatarRadius + 2 - (circleDrawHeight - avatarCircleSize) / 2;
    }
    
    ctx.drawImage(avatar, circleDrawX, circleDrawY, circleDrawWidth, circleDrawHeight);
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 18px FranklinGothic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const textX = 156;
    const textY = 10;
    
    ctx.fillText('TEXT XP', 12, textY + 68);
    ctx.fillText(`#${position}`, 84, textY + 68);
    ctx.fillText(points.toString(), 12, textY + 88);
    ctx.fillText('VOICE XP', textX, textY + 68);
    ctx.fillText(`#${voicePosition}`, textX + 80, textY + 68);
    ctx.fillText(voicePoints.toString(), textX, textY + 88);

    ctx.font = 'bold 24px FranklinGothic';
    ctx.fillText(`${username}`, 10, 30);

    ctx.restore();

    return new AttachmentBuilder(canvas.toBuffer(), { name: `af-${interaction.user.id}.png` });
}

module.exports = {
	getActivityFrame
}