const { ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require("discord.js");
const { Db } = require("mongodb");
const logger = require('../../logger')


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
					'El sistema de experiencia de texto está controlado por el bot **ProBot**, que suma puntos de experiencia de texto al usuario cuando este envía un mensaje en un canal del servidor. El mensaje puede ser de *texto*, *imágenes*, *emojis*, etc.\n\n' +
					'El bot **GDVenezuelaBot** extrae la información de la experiencia de texto de un grupo de usuarios mediante ProBot y luego la muestra en una lista de clasificación, pero hay un límite de usuarios que pueden entrar a esa lista, que actualmente es de 25. Como recompensa por entrar en la lista, se te añadirá el rol <@&1302401396133466246>, que se mantendrá contigo siempre que te mantengas activo en los canales de texto, ya que el rol se eliminará si caes por debajo del puesto 35. Si eres muy activo y logras llegar al primer puesto, el rol de <@&1302401396133466246> será permanente, aunque dejes de ser activo.\n\n' +
					'Recuerda que el bot **ProBot** cuenta con un sistema que evita el spam de experiencia; solo cuenta la experiencia de texto cada cierto tiempo.'
				)
				.setColor(0x2b2d31),
			new EmbedBuilder()
                .setTitle('Comandos')
                .setFields(
                    {
                        name: '/textxp leaderboard',
                        value: 'Muestra la tabla de clasificación de 25 usuarios. La tabla se actualizará cada 5 o 10 días, dependiendo de lo activos que estén los usuarios en el servidor.'
                    },
					{
						name: '/textxp usuario posicion',
						value: 'Muestra tu posición en la tabla de clasificación de 35 puestos. Si el bot te responde que no estás entre los 35 primeros, significa que aún te falta experiencia. Pero, aunque **ProBot** te muestre que estás entre los 35 primeros, no significa que **GDVenezuelaBot** te muestre tu posición, ya que primero debes llegar al puesto 25 o superior para tener el rol de <@&1302401396133466246> y que el bot pueda tener en cuenta tu posición.'
					},
					{
						name: '/textxp usuario salir',
						value: 'Sales de la tabla de clasificación de **GDVenezuelaBot**, lo que quiere decir que perderás el rol de Estrella y no formarás parte de la próxima actualización de la tabla de clasificación. Si tenías el rol permanente de <@&1302401396133466246>, este no se revocará, es decir, que puedes quedarte sin el rol, pero aún conservarás el permanente.'
					},
					{
						name: '/textxp usuario unirse',
						value: 'Regresas a la tabla de clasificación, lo que significa que el bot te asignará el rol de <@&1302401396133466246> y, en la próxima actualización de la tabla, formarás parte de ella. Si antes tenías el rol permanente de <@&1302401396133466246>, pero en esta ocasión regresas, significará que recuperarás tu rol permanente, aunque no formes parte de la tabla de clasificación.'
					}
                )
                .setColor(0x2b2d31),
            new EmbedBuilder()
                .setTitle('Preguntas Frecuentes')
                .setFields(
                    {
                        name: '¿Qué sucede si me retiro del servidor?',
                        value: 'Tu experiencia se conserva, pero si regresas no recibirás el rol de <@&1302401396133466246> automáticamente hasta la próxima actualización de la tabla de clasificación.'
                    },
					{
						name: '¿Puedo pedir experiencia en texto?',
                        value: 'Solo puedes solicitar experiencia si tuviste una cuenta anterior y, por algún motivo, la perdiste. Se te devolverán los puntos de experiencia.'
					},
					{
						name: '¿Puedo conseguir más experiencia si boosteo el servidor?',
                        value: 'Si puedes, el bot **ProBot** te recompensará con más experiencia de lo habitual.'
					},
                )
                .setColor(0x2b2d31)
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