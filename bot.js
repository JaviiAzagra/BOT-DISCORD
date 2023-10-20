const Discord = require("discord.js");
const Enmap = require("enmap");
const config = require("./config/config.json");

const client = new Discord.Client({
  restTimeOffset: 0,
  partials: ["MESSAGE", "CHANNEL", "REACTION", "GUILD_MEMBER", "USER"],
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MEMBERS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    Discord.Intents.FLAGS.GUILD_VOICE_STATES,
    Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Discord.Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
  ],
});

client.aliases = new Discord.Collection();

function requerirhandlers() {
  ["distube"].forEach((handler) => {
    try {
      require(`./handlers/${handler}`)(client, Discord);
    } catch (e) {
      console.warn(e);
    }
  });
}
requerirhandlers();

client.db = new Enmap({
  name: "db",
  dataDir: "./db",
});

client.tickets = new Enmap({
  name: "tickets",
  dataDir: "./tickets",
});

client.setups = new Enmap({
  name: "setups",
  dataDir: "./databases",
});

client.on("ready", () => {
  console.log(`Ok ${client.user.tag}`);

  let estados = ["p/comandos"];
  let posicion = 0;
  setInterval(() => {
    if (posicion > estados.length - 1) posicion = 0;
    let estado = estados[posicion];
    client.user.setActivity(estado, { type: "WATCHING" });
    posicion++;
  }, 10000);
});

// comandos

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild || !message.channel) return;
  client.setups.ensure(message.guild.id, {
    welcomechannel: "",
    welcomemessage: "",
  });

  if (!message.guild || message.author.bot) return;

  if (!message.content.startsWith(config.prefix)) return;

  if (message.author.bot) return;

  const args = message.content.slice(config.prefix.length).trim().split(" ");
  const command = args.shift()?.toLowerCase();

  client.db.ensure(message.guild.id, {
    channel: "",
    message: "",
    category: "",
  });

  if (command === "ping") {
    message.reply(`El ping del bot es \`${client.ws.ping}ms\``);
  }

  if (command == "setup-welcome") {
    const channel =
      message.guild.channels.cache.get(args[0]) ||
      message.mentions.channels.first();
    if (!channel)
      return message.reply(
        `EL CANAL que has mencionado NO EXISTE!\n**Uso:** \`${config.prefix}setup-welcome <#CANAL O ID> <MENSAJE DE BIENVENIDA>\``
      );
    if (!args.slice(1).join(" "))
      return message.reply(
        `NO has especificado el MENSAJE DE BIENVENIDA!\n**Uso:** \`${config.prefix}setup-welcome <#CANAL O ID> <MENSAJE DE BIENVENIDA>\``
      );
    let obj = {
      welcomechannel: channel.id,
      welcomemessage: args.slice(1).join(" "),
    };
    client.setups.set(message.guild.id, obj);
    return message.reply(
      `✅ Se ha configurado correctamente el canal de bienvenida\n**Canal:** ${channel}\n**Mensaje de Bienvenida:** ${args
        .slice(1)
        .join(" ")}`
    );
  }

  if (command === "setup") {
    let channel =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]);
    if (!channel)
      return message.reply("No he encontrado el canal que has mencionado");

    const msg = await channel.send({
      embeds: [
        new Discord.MessageEmbed()
          .setTitle("Crea un ticket")
          .setDescription(
            `🔴 Si necesitas ayuda, tan solo haz click en el boton que dice \`🎫 SOPORTE\` \n
            🔴 Si tienes alguna duda con el bot dale al boton que dice \`🆘 AYUDA BOT\` \n`
          )
          .setColor("#a900ff")
          .setTimestamp(),
      ],
      components: [
        new Discord.MessageActionRow().addComponents([
          new Discord.MessageButton()
            .setStyle("SUCCESS")
            .setLabel("SOPORTE")
            .setEmoji("🎫")
            .setCustomId("crearticket"),
          [
            new Discord.MessageButton()
              .setStyle("DANGER")
              .setLabel("AYUDA BOT")
              .setEmoji("🆘")
              .setCustomId("ayuda"),
          ],
        ]),
      ],
    });

    client.db.set(message.guild.id, channel.id, "channel");
    client.db.set(message.guild.id, msg.id, "message");
    client.db.set(message.guild.id, channel.parentId, "category");

    return message.reply(
      `Sistema de tickets configurado exitosamente ${channel}`
    );
  }

  if (command === "avatar") {
    let usuario = message.mentions.members.first() || message.member;
    message.delete(usuario);

    const avatar = await message.channel.send({
      embeds: [
        new Discord.MessageEmbed()
          .setTitle(`Avatar del sexy ${usuario.user.username}`)
          .setImage(
            usuario.user.displayAvatarURL({ size: 1024, dynamic: true })
          )
          .setFooter(`Pedido por ${usuario.user.username}`),
      ],
    });
  }

  if (command === "bot") {
    const mensaje = args.join(" ");
    if (!mensaje) return message.channel.send("Debes escribir algo");

    setTimeout(function () {
      message.delete();
      message.channel.send(`${mensaje}`);
    }, 10);
  }

  if (command === "comandos") {
    let usuario = message.mentions.members.first() || message.member;
    message.delete(usuario);

    const comandos = await message.channel.send({
      embeds: [
        new Discord.MessageEmbed()
          .setTitle(`Comandos de ${client.user.tag}`)
          .setDescription(
            `**p/ping:** Saber el ping de ${client.user.tag}. \n **p/avatar**: Te muestra lo sexy que eres. \n **p/info:** Info de todo el servidor. \n **------------------------------------**\n **Música** \n **p/play:** Poner música. \n **p/skip:** Saltar a la siguiente canción. \n **p/stop:** Para la música en el canal de voz que estes.`
          )
          .setColor("#a900ff"),
      ],
    });
  }

  if (command === "play") {
    if (!args.length)
      return message.reply(
        `❌ **Tienes que especificar el nombre de la cancion!** \n **/skip para saltar una canción** \n **/stop para parar la canción**`
      );
    if (!message.member.voice?.channel)
      return message.reply(
        `❌ **Tienes que estar en une canal de voz para poder ejecutar este comando**`
      );
    if (
      message.guild.me.voice?.channel &&
      message.member.voice?.channel.id != message.guild.me.voice?.channel.id
    )
      return message.reply(
        `❌ **Tienes que estar en el mismo canal de voz que ${client.user.tag} para poder ejecutar este comando**`
      );

    client.distube.play(message.member.voice?.channel, args.join(" "), {
      member: message.member,
      textChannel: message.channel,
      message,
    });
    message.reply(`🔎 **Buscando \`${args.join(" ")}\`..**`);
  }

  if (command === "skip") {
    const queue = client.distube.getQueue(message);
    if (!queue)
      return message.reply(`❌ **No hay ninguna cancion reproduciendose!**`);
    if (!message.member.voice?.channel)
      return message.reply(
        `❌ **Tienes que estar en un canal de voz para poder ejecutar este comando!**`
      );
    if (
      message.guild.me.voice?.channel &&
      message.member.voice?.channel.id != message.guild.me.voice?.channel.id
    )
      return message.reply(
        `❌ **Tienes que estar en el mismo canal de voz que ${client.user.tag} pra poder ejecutar este comando!**`
      );

    client.distube.skip(message);
    message.reply(`⏭ **Skipeando a la siguiente canción!**`);
  }

  if (command === "stop") {
    const queue = client.distube.getQueue(message);
    if (!queue)
      return message.reply(`❌ **No hay ninguna canción reproduciendose!**`);
    if (!message.member.voice?.channel)
      return message.reply(
        `❌ **Tienes que estar en un canal de voz para poder ejecutar este comando!**`
      );
    if (
      message.guild.me.voice?.channel &&
      message.member.voice?.channel.id != message.guild.me.voice?.channel.id
    )
      return message.reply(
        `❌ **Tienes que estar en el mismo canal de voz que ${client.user.tag} pra poder ejecutar este comando!**`
      );
    client.distube.stop(message);
    message.reply(`**Me voy a por tabaco ** 🚬`);
  }

  if (command === "info") {
    const guild = message.guild;
    const servericon = guild.iconURL({ size: 256, dynamic: true });
    const owner = await guild.fetchOwner();

    if (servericon) {
      return message.reply({
        embeds: [
          new Discord.MessageEmbed()
            .setTitle("SERVER INFO")
            .setThumbnail(`${servericon}`)
            .setDescription(
              `**Server Name:** ${guild.name}\n**Owners:** ${
                owner ? owner.user.tag : "Unknown"
              }\n**Emojis:** ${guild.emojis.cache.size}\n**Roles:** ${
                guild.roles.cache.size
              }\n**Features:** ${guild.features.join(", ")}\n**Boosts:** ${
                guild.premiumSubscriptionCount
              }`
            )
            .setColor("#a900ff")
            .setTimestamp(),
        ],
      });
    } else {
      return message.reply({
        embeds: [
          new Discord.MessageEmbed()
            .setTitle("SERVER INFO")
            .setDescription(
              `**Server Name:** ${guild.name}\n**Owner:** ${
                owner ? owner.user.tag : "Unknown"
              }\n**Emojis:** ${guild.emojis.cache.size}\n**Roles:** ${
                guild.roles.cache.size
              }\n**Features:** ${guild.features.join(", ")}}\n**Boosts:** ${
                guild.premiumSubscriptionCount
              }`
            )
            .setColor("#a900ff")
            .setTimestamp(),
        ],
      });
    }
  }
});

//! ///////////////////////////////////////////////////////////  TICKETS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

client.on("interactionCreate", async (interaction) => {
  if (
    !interaction.isButton() ||
    !interaction.guildId ||
    interaction.message.author.id != client.user.id
  )
    return;

  client.db.ensure(interaction.guild.id, {
    channel: "",
    message: "",
    category: "",
  });

  const data = client.db.get(interaction.guild.id);

  if (
    interaction.channelId == data.channel &&
    interaction.message.id == data.message
  ) {
    switch (interaction.customId) {
      //! ////////////////////////////////////////////////////////////  SOPORTE  \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
      case "crearticket": {
        if (client.tickets.has(interaction.member.user.id)) {
          let ticket = interaction.guild.channels.cache.get(
            client.tickets.get(interaction.member.user.id, "channelid")
          );
          if (
            ticket &&
            client.tickets.get(interaction.member.user.id, "closed") == false
          )
            return interaction.reply({
              content: `❌Ya tienes un ticket creado en <#${ticket.id}>`,
              ephemeral: true,
            });
        }

        await interaction.reply({
          content: "Creando tu ticket... Porfavor espere",
          ephemeral: true,
        });
        const channel = await interaction.guild.channels.create(
          `ticket-${interaction.member.user.username}`,
          {
            type: "GUILD_TEXT",
            parent: data.category,
            permissionOverwrites: [
              {
                id: interaction.guild.id,
                deny: ["VIEW_CHANNEL"],
              },
              {
                id: interaction.member.user.id,
                allow: ["VIEW_CHANNEL"],
              },
            ],
          }
        );

        channel.send({
          embeds: [
            new Discord.MessageEmbed()
              .setTitle(`Ticket de ${interaction.member.user.tag}`)
              .setDescription(
                `Bienvenido al soporte ${interaction.member}\n**Explica detalladamente tu problema**`
              )
              .setColor("#a900ff")
              .setTimestamp(),
          ],
          components: [
            new Discord.MessageActionRow().addComponents([
              new Discord.MessageButton()
                .setStyle("DANGER")
                .setLabel("CERRAR")
                .setEmoji("🔒")
                .setCustomId("cerrarticket"),
              new Discord.MessageButton()
                .setStyle("SECONDARY")
                .setLabel("BORRAR")
                .setEmoji("🗑")
                .setCustomId("borrarticket"),
            ]),
          ],
        });

        client.tickets.set(interaction.member.user.id, {
          channelid: channel.id,
          closed: false,
        });

        return await interaction.editReply({
          content: `✅ Ticket creado en ${channel}!`,
        });
      }
      //! ////////////////////////////////////////////////////////////  AYUDA  \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
      case "ayuda": {
        if (client.tickets.has(interaction.member.user.id)) {
          let ticket = interaction.guild.channels.cache.get(
            client.tickets.get(interaction.member.user.id, "channelid")
          );
          if (
            ticket &&
            client.tickets.get(interaction.member.user.id, "closed") == false
          )
            return interaction.reply({
              content: `❌Ya tienes un ticket creado en <#${ticket.id}>`,
              ephemeral: true,
            });
        }

        await interaction.reply({
          content: "Creando tu ticket... Porfavor espere",
          ephemeral: true,
        });
        const channel = await interaction.guild.channels.create(
          `ticket AYUDA-${interaction.member.user.username}`,
          {
            type: "GUILD_TEXT",
            parent: data.category,
            permissionOverwrites: [
              {
                id: interaction.guild.id,
                deny: ["VIEW_CHANNEL"],
              },
              {
                id: interaction.member.user.id,
                allow: ["VIEW_CHANNEL"],
              },
            ],
          }
        );

        channel.send({
          embeds: [
            new Discord.MessageEmbed()
              .setTitle(`Ticket de ${interaction.member.user.tag}`)
              .setDescription(
                `Bienvenido a mi canal ${interaction.member}\n**Si tienes alguna duda del bot ${client.user.tag} no dudes en consultarnosla.**`
              )
              .setColor("#a900ff")
              .setTimestamp(),
          ],
          components: [
            new Discord.MessageActionRow().addComponents([
              new Discord.MessageButton()
                .setStyle("DANGER")
                .setLabel("CERRAR")
                .setEmoji("🔒")
                .setCustomId("cerrarticket"),
              new Discord.MessageButton()
                .setStyle("SECONDARY")
                .setLabel("BORRAR")
                .setEmoji("🗑")
                .setCustomId("borrarticket"),
            ]),
          ],
        });

        client.tickets.set(interaction.member.user.id, {
          channelid: channel.id,
          closed: false,
        });

        return await interaction.editReply({
          content: `✅ Ticket creado en ${channel}!`,
        });
      }
      default:
        break;
    }
  }
  if (
    client.tickets.has(
      client.tickets.findKey((t) => t.channelid == interaction.channelId)
    )
  ) {
    switch (interaction.customId) {
      case "cerrarticket":
        {
          const key = client.tickets.findKey(
            (t) => t.channelid == interaction.channelId
          );
          if (key) {
            const ticket = client.tickets.get(key);
            if (ticket.closed == true)
              return interaction.reply({
                content: "❌ Este ticket ya estaba cerrado!",
                ephemeral: true,
              });
            const msg = await interaction.reply(
              "El ticket se auto-cerrará en 3 segundos..."
            );
            setTimeout(async () => {
              await interaction.editReply({ content: "TICKET CERRADO 🔒" });
              client.tickets.set(key, true, "closed");
              return interaction.channel.permissionOverwrites.edit(key, {
                VIEW_CHANNEL: false,
              });
            }, 3 * 1000);
          }
        }
        break;
      case "borrarticket":
        {
          await interaction.reply("El ticket se eliminará en 3 segundos...");
          setTimeout(() => {
            interaction.channel.delete();
          }, 3 * 1000);
        }
        break;
      default:
        break;
    }
  }
});

//! ////////////////////////////////////////////////////////  BIENVENIDA  \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
client.on("guildMemberAdd", async (member) => {
  client.setups.ensure(member.guild.id, {
    welcomechannel: "",
    welcomemessage: "",
  });

  try {
    const data = client.setups.get(member.guild.id);
    if (data) {
      if (member.guild.channels.cache.get(data.welcomechannel)) {
        const channel = member.guild.channels.cache.get(data.welcomechannel);
        const attachment = new Discord.MessageAttachment(
          "https://imgur.com/YTL60WR.gif"
        );
        channel.send({
          content: data.welcomemessage.replace(/{usuario}/, member),
          files: [attachment],
        });
      }
    }
  } catch (e) {
    console.log(e);
  }
});

client.login(config.token);
