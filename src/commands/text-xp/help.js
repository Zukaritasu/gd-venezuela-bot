const { ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require("discord.js");
const { Db } = require("mongodb");
const logger = require('../../logger')
const topLimits = require('../../../.botconfig/top-limits.json')


/**
 * @param {Db} _database 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function execute(_database, interaction) {
	try {
		await interaction.deferReply()
		const pages = [
			new EmbedBuilder()
				.setTitle('SISTEMA DE EXPERIENCIA DE TEXTO')
				.setDescription(
					'El sistema de experiencia de texto está controlado por el bot **GDVenezuelaBot**, que suma puntos de experiencia de texto al usuario cuando este envía un mensaje en un canal del servidor. El mensaje puede ser de *texto*, *imágenes*, *emojis*, *reacciones*, etc.\n\n' +
					`El bot **GDVenezuelaBot** extrae la información de la experiencia de texto de un grupo de usuarios y luego la muestra en una lista de clasificación, pero hay un límite de usuarios que pueden entrar a esa lista, que actualmente es de ${topLimits.positions}. Como recompensa por entrar en la lista, se te añadirá el rol <@&1302401396133466246>, que se mantendrá contigo siempre que te mantengas activo en los canales de texto, ya que el rol se eliminará si caes por debajo del puesto ${topLimits.limit}. Si eres muy activo y logras llegar al primer puesto, el rol de <@&1302401396133466246> será permanente, aunque dejes de ser activo, pero solo es válido si lograste alcanzar una cantidad mínima de ${topLimits.superStarThreshold} puntos de experiencia.\n\n` +
					`Como plus extra también dispones del rol <@&1487970424225529866>, que se otorga a los usuarios que alcanzan una cantidad mínima de ${topLimits.superStarThreshold} puntos de experiencia y que se mantendrá contigo siempre que te mantengas activo en los canales de texto, ya que el rol se eliminará si caes por debajo del puesto ${topLimits.maxSuperStars}. Este rol te otorga beneficios especiales. Consultar [Pag 3].\n\n` +
					'Recuerda que el bot cuenta con un sistema que evita el spam de experiencia; solo cuenta la experiencia de texto cada cierto tiempo.'
				)
				.setColor(0x2b2d31)
				.setFooter({ text: 'Pag 1/3' }),
			new EmbedBuilder()
				.setTitle('COMANDOS')
				.setFields(
					{
						name: '/textxp leaderboard',
						value: `Muestra la tabla de clasificación de ${topLimits.positions} usuarios. La tabla se actualizará cada 5 días.`
					},
					{
						name: '/textxp usuario posicion',
						value: 'Muestra tu posición en la tabla global.'
					},
					{
						name: '/textxp usuario actividad',
						value: 'Muestra tus puntos de experiencia de texto y voz.'
					},
					{
						name: '/textxp usuario salir',
						value: 'Sales de la tabla de clasificación de **GDVenezuelaBot**, lo que quiere decir que perderás el rol de **Estrellas** y **Super Estrella** *(si aplica)* y no formarás parte de la próxima actualización de la tabla de clasificación. Si tenías el rol permanente de <@&1302401396133466246>, este no se revocará, es decir, que puedes quedarte sin el rol, pero aún conservarás el permanente.'
					},
					{
						name: '/textxp usuario unirse',
						value: `Regresas a la tabla de clasificación, lo que significa que el bot te asignará el rol de <@&1302401396133466246> y **Super Estrella** *(si aplica)*, y en la próxima actualización de la tabla, formarás parte de ella. Si antes tenías el rol permanente de <@&1302401396133466246>, pero en esta ocasión regresas, significará que recuperarás tu rol permanente, aunque no formes parte de la tabla de clasificación.`
					},
					{
						name: '/textxp help',
						value: 'Muestra esta información.'
					}
				)
				.setColor(0x2b2d31)
				.setFooter({ text: 'Pag 2/3' }),
			new EmbedBuilder()
				.setTitle('PREGUNTAS FRECUENTES')
				.setFields(
					{
						name: '¿Qué sucede si me retiro del servidor?',
						value: 'Tu experiencia se conserva, pero si regresas no recibirás el rol de <@&1302401396133466246> y <@&1487970424225529866> *(si aplica)* automáticamente hasta la próxima actualización de la tabla de clasificación.'
					},
					{
						name: '¿Puedo pedir experiencia en texto?',
						value: 'Solo puedes solicitar experiencia si tuviste una cuenta anterior y, por algún motivo, la perdiste. Se te devolverán los puntos de experiencia.'
					},
					{
						name: '¿Puedo conseguir más experiencia si boosteo el servidor?',
						value: 'Sí puedes, el bot te recompensará con un 20% adicional de experiencia.'
					},
					{
						name: '¿Cuáles son los requisitos para obtener el rol Super Estrella?',
						value: `Para obtener el rol de <@&1487970424225529866>, debes estar dentro del top ${topLimits.maxSuperStars} usuarios con más experiencia de texto en el servidor y cumplir con un mínimo de ${topLimits.superStarThreshold} puntos.`
					},
					{
						name: '¿Puedo perder el rol de Super Estrella?',
						value: `Si sales del top ${topLimits.maxSuperStars}, perderás el rol de <@&1487970424225529866>, así que mantente activo para conservarlo!`
					},
					{
						name: '¿Puedo perder el rol de Estrellas?',
						value: `Si sales del top ${topLimits.limit}, perderás el rol de <@&1302401396133466246>, así que mantente activo para conservarlo!`
					},
					{
						name: '¿Puedo perder el rol permanente de Estrellas?',
						value: `No, el rol permanente de <@&1302401396133466246> no se puede perder, aunque salgas del puesto 1 o puesto ${topLimits.limit} o pierdas el rol de Estrellas, el rol permanente se mantendrá contigo.`
					},
					{
						name: '¿Cuáles son las ventajas de tener el rol Super Estrella?',
						value: 'Tener el rol de <@&1487970424225529866> te otorga reconocimiento especial por tu actividad en el servidor y acceso a funciones exclusivas, las cuales son:\n- Puedes enviar contenido multimedia o archivos en <#1120171944378110112>\n- Puedes enviar links en <#1120171944378110112> *(esto incluye gifs)*'
					},
					{
						name: '¿Puedo ser sancionado por abusar del rol Super Estrella?',
						value: 'Si se demuestra que estás abusando del rol, podrías ser sancionado. Por favor, usa el rol de forma responsable y respetuosa. Evita hacer spam de contenido multimedia o links ya que esto puede resultar molesto para otros miembros del servidor. Recuerda que el rol de <@&1487970424225529866> es un reconocimiento a tu actividad, así que úsalo de manera positiva y constructiva.'
					}
				)
				.setColor(0x2b2d31)
				.setFooter({ text: 'Pag 3/3' })
		];

		let page = 0;

		const getRow = () => new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('prev')
					.setEmoji({
						id: '1044790805501575228',
						name: 'arrowleft'
					})
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId('next')
					.setEmoji({
						id: '1044790809804943410',
						name: 'arrowright'
					})
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === pages.length - 1)
			);

		const reply = await interaction.editReply({ embeds: [pages[page]], components: [getRow()] });

		const collector = reply.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 2 * 60 * 1000 // 2 minutes
		});

		collector.on('collect', async i => {
			if (i.user.id !== interaction.user.id) {
				await i.reply(
					{
						content: 'Solo quien ejecutó el comando puede usar los botones.',
						ephemeral: true
					});
				return;
			}

			if (i.customId === 'next' && page < pages.length - 1) {
				page++;
			} else if (i.customId === 'prev' && page > 0) {
				page--;
			}

			await i.update(
				{
					embeds: [pages[page]],
					components: [getRow()]
				});
		});

		collector.on('end', async () => {
			const disabledRow = getRow();
			disabledRow.components.forEach(btn => btn.setDisabled(true));
			await interaction.editReply(
				{
					components: [disabledRow]
				}
			);
		});
	} catch (error) {
		logger.ERR(error);
		try {
			await interaction.reply({
				content: 'Ups! Ha ocurrido un error. Intenta mas tarde... <:birthday2:1249345278566465617>'
			})
		} catch (e) {

		}
	}
}

module.exports = {
	execute
}