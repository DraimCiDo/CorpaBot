import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Interaction,
  InteractionType,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  UserSelectMenuBuilder,
  AutocompleteInteraction,
  VoiceChannel,
  TextChannel,
  CategoryChannel,
} from "discord.js";
import {
  CREATE_CHANNEL_NAME,
  INTERFACE_CHANNEL_NAME,
  VOICE_CATEGORY_NAME,
  TEMP_CHANNEL_PREFIX,
  LOCK_OPEN,
  LOCK_CLOSED,
  ICON_PRIVACY,
  ICON_RENAME,
  ICON_LIMIT,
  ICON_REGION,
  ICON_DELETE,
  ICON_INVITE,
  ICON_KICK,
  ICON_BLOCK,
  ICON_UNBLOCK,
  ICON_TRUSTED_ADD,
  ICON_TRUSTED_REMOVE,
  ICON_TRANSFER,
} from "../constants";
import {
  createdChannels,
  channelOwners,
  trustedUsers,
  channelNumbers,
  channelNames,
  availableNumbers,
} from "../state";
import { isManager, getUserTempChannel, formatChannelName } from "../voice";

async function sendInterfaceMessage(interfaceChannel: TextChannel) {
  const embed = new EmbedBuilder()
    .setTitle("Настройка временного канала")
    .setColor(0x00ff00)
    .setDescription(
      "Используйте кнопки ниже чтобы управлять созданным для вас голосовым каналом."
    )
    .setImage(
      "https://cdn.discordapp.com/attachments/1148739831594242211/1381962774590132234/NEUKRAL2004.png?ex=68569ba1&is=68554a21&hm=c258a72a5a3406357054ede7d23ad573639576ea9a00338a745bbd869d947073&"
    );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("toggle_privacy")
      .setEmoji(ICON_PRIVACY)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("rename")
      .setEmoji(ICON_RENAME)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("set_limit")
      .setEmoji(ICON_LIMIT)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("change_region")
      .setEmoji(ICON_REGION)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("delete_channel")
      .setEmoji(ICON_DELETE)
      .setStyle(ButtonStyle.Danger)
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("invite_user")
      .setEmoji(ICON_INVITE)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("kick_user")
      .setEmoji(ICON_KICK)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("block_user")
      .setEmoji(ICON_BLOCK)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("unblock_user")
      .setEmoji(ICON_UNBLOCK)
      .setStyle(ButtonStyle.Secondary)
  );

  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("add_trusted")
      .setEmoji(ICON_TRUSTED_ADD)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("remove_trusted")
      .setEmoji(ICON_TRUSTED_REMOVE)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("transfer_leader")
      .setEmoji(ICON_TRANSFER)
      .setStyle(ButtonStyle.Secondary)
  );

  await interfaceChannel.send({
    embeds: [embed],
    components: [row1, row3, row4],
  });
}

export async function handleInteraction(interaction: Interaction) {
  if (interaction.isAutocomplete() && interaction.commandName === "voice") {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "user") {
      const channel = getUserTempChannel(
        interaction as AutocompleteInteraction
      );
      const members = channel ? [...channel.members.values()] : [];
      await interaction.respond(
        members.slice(0, 25).map((m) => ({ name: m.displayName, value: m.id }))
      );
    } else {
      await interaction.respond([]);
    }
    return;
  }
  if (interaction.isChatInputCommand() && interaction.commandName === "setup") {
    if (!interaction.guild) {
      await interaction.reply({
        content: "Эту команду можно использовать только на сервере",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const memberPerms = interaction.memberPermissions;
    if (!memberPerms || !memberPerms.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({
        content: "Недостаточно прав для выполнения команды",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const existing = interaction.guild.channels.cache.find(
      (c: any) =>
        c.name === CREATE_CHANNEL_NAME && c.type === ChannelType.GuildVoice
    ) as VoiceChannel | undefined;

    const existingInterface = interaction.guild.channels.cache.find(
      (c: any) =>
        c.name === INTERFACE_CHANNEL_NAME && c.type === ChannelType.GuildText
    );

    const existingCategory = interaction.guild.channels.cache.find(
      (c: any) =>
        c.name === VOICE_CATEGORY_NAME && c.type === ChannelType.GuildCategory
    );

    if (existing) {
      await interaction.reply({
        content: `Канал уже существует: ${existing}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const category = existingCategory
      ? (existingCategory as CategoryChannel)
      : await interaction.guild.channels.create({
          name: VOICE_CATEGORY_NAME,
          type: ChannelType.GuildCategory,
        });

    const interfaceChannel = existingInterface
      ? (existingInterface as TextChannel)
      : ((await interaction.guild.channels.create({
          name: INTERFACE_CHANNEL_NAME,
          type: ChannelType.GuildText,
          parent: category.id,
        })) as TextChannel);

    if (existingInterface && existingInterface.parentId !== category.id) {
      await (existingInterface as TextChannel).setParent(category.id);
    }

    const channel = await interaction.guild.channels.create({
      name: CREATE_CHANNEL_NAME,
      type: ChannelType.GuildVoice,
      parent: category.id,
    });

    await sendInterfaceMessage(interfaceChannel);

    await interaction.reply({
      content: `Создан канал ${channel} и ${interfaceChannel}`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "interface"
  ) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "Эту команду можно использовать только на сервере",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const memberPerms = interaction.memberPermissions;
    if (!memberPerms || !memberPerms.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({
        content: "Недостаточно прав для выполнения команды",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const interfaceChannel = interaction.guild.channels.cache.find(
      (c: any) =>
        c.name === INTERFACE_CHANNEL_NAME && c.type === ChannelType.GuildText
    ) as TextChannel | undefined;

    if (!interfaceChannel) {
      await interaction.reply({
        content: "Канал Интерфейс не найден",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await sendInterfaceMessage(interfaceChannel);
    await interaction.reply({
      content: "Сообщение обновлено",
      flags: MessageFlags.Ephemeral,
    });
  } else if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "voice"
  ) {
    const sub = interaction.options.getSubcommand();
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: "Вы должны находиться в своём временном канале",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!isManager(channel.id, interaction.user.id)) {
      await interaction.reply({
        content: "Недостаточно прав",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (sub === "privacy") {
      const everyone = interaction.guild!.roles.everyone;
      const overwrite = channel.permissionOverwrites.resolve(everyone.id);
      const isPrivate = overwrite?.deny.has(PermissionFlagsBits.Connect);
      await channel.permissionOverwrites.edit(everyone, {
        Connect: isPrivate ? null : false,
      });
      const lockName = formatChannelName(channel.id, !isPrivate);
      await channel.setName(lockName);
      await interaction.reply({
        content: isPrivate
          ? "Канал теперь публичный"
          : "Канал теперь приватный",
        flags: MessageFlags.Ephemeral,
      });
    } else if (sub === "rename") {
      const name = interaction.options.getString("name", true);
      channelNames.set(channel.id, name);
      const everyone = interaction.guild!.roles.everyone;
      const overwrite = channel.permissionOverwrites.resolve(everyone.id);
      const isPrivate = !!overwrite?.deny.has(PermissionFlagsBits.Connect);
      await channel.setName(formatChannelName(channel.id, isPrivate));
      await interaction.reply({
        content: `Название канала изменено на ${name}`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (sub === "limit") {
      const limit = interaction.options.getInteger("limit", true);
      if (limit < 0 || limit > 99) {
        await interaction.reply({
          content: "Неверное значение",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await channel.setUserLimit(limit);
      await interaction.reply({
        content: `Лимит установлен: ${limit}`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (sub === "delete") {
      await channel.delete();
      createdChannels.delete(channel.id);
      channelOwners.delete(channel.id);
      trustedUsers.delete(channel.id);
      const number = channelNumbers.get(channel.id);
      if (number !== undefined) {
        availableNumbers.add(number);
      }
      channelNumbers.delete(channel.id);
      channelNames.delete(channel.id);
      await interaction.reply({
        content: "Канал удалён",
        flags: MessageFlags.Ephemeral,
      });
    } else if (sub === "region") {
      const value = interaction.options.getString("region", true);
      await channel.setRTCRegion(value === "auto" ? null : value);
      await interaction.reply({
        content: `Регион канала установлен: ${value}`,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      const id = interaction.options.getString("user", true);
      const member = await interaction.guild?.members
        .fetch(id)
        .catch(() => null);
      if (!member) {
        await interaction.reply({
          content: "Пользователь не найден",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (sub === "invite") {
        await channel.permissionOverwrites.edit(member, { Connect: true });
        await interaction.reply({
          content: `Пользователь приглашён: ${member}`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (sub === "kick") {
        if (member.voice.channelId !== channel.id) {
          await interaction.reply({
            content: "Пользователь не найден в канале",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await member.voice.disconnect();
        await interaction.reply({
          content: `Пользователь выгнан: ${member}`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (sub === "block") {
        await channel.permissionOverwrites.edit(member, { Connect: false });
        await interaction.reply({
          content: `Пользователь заблокирован: ${member}`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (sub === "unblock") {
        await channel.permissionOverwrites.delete(member);
        await interaction.reply({
          content: `Пользователь разблокирован: ${member}`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (sub === "addtrusted") {
        const set = trustedUsers.get(channel.id) ?? new Set();
        set.add(id);
        trustedUsers.set(channel.id, set);
        await interaction.reply({
          content: "Доверенный пользователь добавлен",
          flags: MessageFlags.Ephemeral,
        });
      } else if (sub === "removetrusted") {
        trustedUsers.get(channel.id)?.delete(id);
        await interaction.reply({
          content: "Доверенный пользователь удалён",
          flags: MessageFlags.Ephemeral,
        });
      } else if (sub === "transfer") {
        channelOwners.set(channel.id, id);
        const set = trustedUsers.get(channel.id) ?? new Set();
        set.add(id);
        trustedUsers.set(channel.id, set);
        await interaction.reply({
          content: "Лидерство передано",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } else if (interaction.isButton()) {
    if (interaction.customId === "toggle_privacy") {
      const channel = getUserTempChannel(interaction);
      if (!channel) {
        await interaction.reply({
          content: "Вы должны находиться в своём временном канале",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: "Недостаточно прав",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const everyone = interaction.guild!.roles.everyone;
      const overwrite = channel.permissionOverwrites.resolve(everyone.id);
      const isPrivate = overwrite?.deny.has(PermissionFlagsBits.Connect);
      await channel.permissionOverwrites.edit(everyone, {
        Connect: isPrivate ? null : false,
      });
      const lockName = formatChannelName(channel.id, !isPrivate);
      await channel.setName(lockName);
      await interaction.reply({
        content: isPrivate
          ? "Канал теперь публичный"
          : "Канал теперь приватный",
        flags: MessageFlags.Ephemeral,
      });
    } else if (interaction.customId === "rename") {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: "Недостаточно прав",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId("rename_modal")
        .setTitle("Переименовать канал");

      const input = new TextInputBuilder()
        .setCustomId("name_input")
        .setLabel("Новое название")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(input)
      );
      await interaction.showModal(modal);
    } else if (interaction.customId === "set_limit") {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: "Недостаточно прав",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId("limit_modal")
        .setTitle("Лимит пользователей");

      const input = new TextInputBuilder()
        .setCustomId("limit_input")
        .setLabel("Число от 0 до 99")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(input)
      );
      await interaction.showModal(modal);
    } else if (interaction.customId === "change_region") {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: "Недостаточно прав",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const menu =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("region_select")
            .setPlaceholder("Выберите регион")
            .addOptions(
              { label: "Авто", value: "auto" },
              { label: "Вротдам", value: "rotterdam" },
              { label: "Сингапур", value: "singapore" },
              { label: "Токио-Дрифт", value: "japan" }
            )
        );
      await interaction.reply({
        content: "Выберите регион",
        components: [menu],
        flags: MessageFlags.Ephemeral,
      });
    } else if (interaction.customId === "invite_user") {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: "Недостаточно прав",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const menu = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId("invite_select")
          .setPlaceholder("Выберите пользователя")
          .setMaxValues(1)
          .setMinValues(1)
      );
      await interaction.reply({
        content: "Выберите пользователя",
        components: [menu],
        flags: MessageFlags.Ephemeral,
      });
    } else if (interaction.customId === "kick_user") {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: "Недостаточно прав",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const menu = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId("kick_select")
          .setPlaceholder("Выберите пользователя")
          .setMaxValues(1)
          .setMinValues(1)
      );
      await interaction.reply({
        content: "Выберите пользователя",
        components: [menu],
        flags: MessageFlags.Ephemeral,
      });
    } else if (interaction.customId === "block_user") {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: "Недостаточно прав",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const menu = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId("block_select")
          .setPlaceholder("Выберите пользователя")
          .setMaxValues(1)
          .setMinValues(1)
      );
      await interaction.reply({
        content: "Выберите пользователя",
        components: [menu],
        flags: MessageFlags.Ephemeral,
      });
    } else if (interaction.customId === "unblock_user") {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: "Недостаточно прав",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const menu = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId("unblock_select")
          .setPlaceholder("Выберите пользователя")
          .setMaxValues(1)
          .setMinValues(1)
      );
      await interaction.reply({
        content: "Выберите пользователя",
        components: [menu],
        flags: MessageFlags.Ephemeral,
      });
    } else if (interaction.customId === "add_trusted") {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: "Недостаточно прав",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const menu = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId("trusted_add_select")
          .setPlaceholder("Выберите пользователя")
          .setMaxValues(1)
          .setMinValues(1)
      );
      await interaction.reply({
        content: "Выберите пользователя",
        components: [menu],
        flags: MessageFlags.Ephemeral,
      });
    } else if (interaction.customId === "remove_trusted") {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: "Недостаточно прав",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const menu = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId("trusted_remove_select")
          .setPlaceholder("Выберите пользователя")
          .setMaxValues(1)
          .setMinValues(1)
      );
      await interaction.reply({
        content: "Выберите пользователя",
        components: [menu],
        flags: MessageFlags.Ephemeral,
      });
    } else if (interaction.customId === "transfer_leader") {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: "Недостаточно прав",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const menu = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId("transfer_select")
          .setPlaceholder("Выберите пользователя")
          .setMaxValues(1)
          .setMinValues(1)
      );
      await interaction.reply({
        content: "Выберите пользователя",
        components: [menu],
        flags: MessageFlags.Ephemeral,
      });
    } else if (interaction.customId === "delete_channel") {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: "Вы должны находиться в своём временном канале",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await channel.delete();
      createdChannels.delete(channel.id);
      channelOwners.delete(channel.id);
      trustedUsers.delete(channel.id);
      const number = channelNumbers.get(channel.id);
      if (number !== undefined) {
        availableNumbers.add(number);
      }
      channelNumbers.delete(channel.id);
      channelNames.delete(channel.id);
      await interaction.reply({
        content: "Канал удалён",
        flags: MessageFlags.Ephemeral,
      });
    }
  } else if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "region_select"
  ) {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: "Вы должны находиться в своём временном канале",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const value = interaction.values[0];
    await channel.setRTCRegion(value === "auto" ? null : value);
    await interaction.reply({
      content: `Регион канала установлен: ${value}`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId === "rename_modal"
  ) {
    await interaction.deferReply({ ephemeral: true });
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.editReply({
        content: "Вы должны находиться в своём временном канале",
      });
      return;
    }
    const name = interaction.fields.getTextInputValue("name_input");
    channelNames.set(channel.id, name);
    const everyone = interaction.guild!.roles.everyone;
    const overwrite = channel.permissionOverwrites.resolve(everyone.id);
    const isPrivate = !!overwrite?.deny.has(PermissionFlagsBits.Connect);
    await channel.setName(formatChannelName(channel.id, isPrivate));
    await interaction.editReply({
      content: `Название канала изменено на ${name}`,
    });
  } else if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId === "limit_modal"
  ) {
    await interaction.deferReply({ ephemeral: true });
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.editReply({
        content: "Вы должны находиться в своём временном канале",
      });
      return;
    }
    const limit = parseInt(
      interaction.fields.getTextInputValue("limit_input"),
      10
    );
    if (isNaN(limit) || limit < 0 || limit > 99) {
      await interaction.editReply({ content: "Неверное значение" });
      return;
    }
    await channel.setUserLimit(limit);
    await interaction.editReply({ content: `Лимит установлен: ${limit}` });
  } else if (
    interaction.isUserSelectMenu() &&
    interaction.customId === "invite_select"
  ) {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: "Вы должны находиться в своём временном канале",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const id = interaction.values[0];
    const member = await interaction.guild?.members.fetch(id).catch(() => null);
    if (!member) {
      await interaction.reply({
        content: "Пользователь не найден",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await channel.permissionOverwrites.edit(member, { Connect: true });
    await interaction.reply({
      content: `Пользователь приглашён: ${member}`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (
    interaction.isUserSelectMenu() &&
    interaction.customId === "kick_select"
  ) {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: "Вы должны находиться в своём временном канале",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const id = interaction.values[0];
    const member = await interaction.guild?.members.fetch(id).catch(() => null);
    if (!member || member.voice.channelId !== channel.id) {
      await interaction.reply({
        content: "Пользователь не найден в канале",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await member.voice.disconnect();
    await interaction.reply({
      content: `Пользователь выгнан: ${member}`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (
    interaction.isUserSelectMenu() &&
    interaction.customId === "block_select"
  ) {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: "Вы должны находиться в своём временном канале",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const id = interaction.values[0];
    const member = await interaction.guild?.members.fetch(id).catch(() => null);
    if (!member) {
      await interaction.reply({
        content: "Пользователь не найден",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await channel.permissionOverwrites.edit(member, { Connect: false });
    await interaction.reply({
      content: `Пользователь заблокирован: ${member}`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (
    interaction.isUserSelectMenu() &&
    interaction.customId === "unblock_select"
  ) {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: "Вы должны находиться в своём временном канале",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const id = interaction.values[0];
    const member = await interaction.guild?.members.fetch(id).catch(() => null);
    if (!member) {
      await interaction.reply({
        content: "Пользователь не найден",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await channel.permissionOverwrites.delete(member);
    await interaction.reply({
      content: `Пользователь разблокирован: ${member}`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (
    interaction.isUserSelectMenu() &&
    interaction.customId === "trusted_add_select"
  ) {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: "Вы должны находиться в своём временном канале",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const id = interaction.values[0];
    const set = trustedUsers.get(channel.id) ?? new Set();
    set.add(id);
    trustedUsers.set(channel.id, set);
    await interaction.reply({
      content: "Доверенный пользователь добавлен",
      flags: MessageFlags.Ephemeral,
    });
  } else if (
    interaction.isUserSelectMenu() &&
    interaction.customId === "trusted_remove_select"
  ) {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: "Вы должны находиться в своём временном канале",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const id = interaction.values[0];
    trustedUsers.get(channel.id)?.delete(id);
    await interaction.reply({
      content: "Доверенный пользователь удалён",
      flags: MessageFlags.Ephemeral,
    });
  } else if (
    interaction.isUserSelectMenu() &&
    interaction.customId === "transfer_select"
  ) {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: "Вы должны находиться в своём временном канале",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const id = interaction.values[0];
    channelOwners.set(channel.id, id);
    const set = trustedUsers.get(channel.id) ?? new Set();
    set.add(id);
    trustedUsers.set(channel.id, set);
    await interaction.reply({
      content: "Лидерство передано",
      flags: MessageFlags.Ephemeral,
    });
  }
}
