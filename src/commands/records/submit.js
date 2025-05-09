const { SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');
const { states } = require('../../../.botconfig/country-states.json');
const { Db } = require('mongodb');
const utils = require('../../utils')
const logger = require('../../logger');


/**
 * 
 * @param {*} _client 
 * @param {*} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_client, _database, interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const channel = await interaction.client.channels.fetch('1369858143122886769');
        if (!channel) {
            await interaction.editReply('No se ha podido encontrar el canal');
            return;
        }
        const player = interaction.options.getString('player');
        const level = interaction.options.getString('level');
        const ytvideo = interaction.options.getString('ytvideo');
        const comment = interaction.options.getString('comment');
        const mobile = interaction.options.getBoolean('mobile') || false;

        let stateName = null;
        
        const length = interaction.member.roles.cache.size;
        for (let i = 0; i < length; i++) {
            const role = interaction.member.roles.cache.at(i);
            if (role) {
                logger.DBG('Role ID:', role.id);
                const state = states.find(state => state.roleId === role.id);
                if (state) {
                    stateName = state.flagUrl.substring(state.flagUrl.lastIndexOf('/') + 1, state.flagUrl.lastIndexOf('.'));
                    break;
                }
            }
        }

        if (!stateName) {
            await interaction.editReply('No se ha podido encontrar el estado');
            return;
        }

        const stringJson = 
        `
        Level: ${level}
Video: ${ytvideo}
Comentario: ${comment ?? ""}
        \`\`\`json
{
    "user": "${player}",
    "link": "${ytvideo}",
    "percent": "100",
    "mobile": ${mobile},
    "flag": "/assets/flags/${stateName}.png"
}
\`\`\``;

        await channel.send(stringJson);
        await interaction.editReply('Tu progreso ha sido enviado para su revisión');
    } catch (e) {
        logger.ERR('Error in submit command:', e);
        await interaction.editReply('An unknown error has occurred');
    }
}

module.exports = {
    execute
};