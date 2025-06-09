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
  AutocompleteInteraction,
  VoiceChannel,
  TextChannel
} from "discord.js";
import {
  CREATE_CHANNEL_NAME,
  INTERFACE_CHANNEL_NAME,
  TEMP_CHANNEL_PREFIX,
  LOCK_OPEN,
  LOCK_CLOSED,
  ICON_PRIVACY,
  ICON_RENAME,
  ICON_LIMIT,
  ICON_DELETE,
  ICON_INVITE,
  ICON_KICK,
  ICON_BLOCK,
  ICON_UNBLOCK,
  ICON_TRUSTED_ADD,
  ICON_TRUSTED_REMOVE,
  ICON_TRANSFER
} from "../constants";
import { createdChannels, channelOwners, trustedUsers, channelNumbers } from "../state";
import { isManager, getUserTempChannel } from "../voice";

export async function handleInteraction(interaction: Interaction) {
  if (interaction.isAutocomplete() && interaction.commandName === 'voice') {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'user') {
      const channel = getUserTempChannel(interaction as AutocompleteInteraction);
      const members = channel ? [...channel.members.values()] : [];
      await interaction.respond(
        members.slice(0, 25).map(m => ({ name: m.displayName, value: m.id }))
      );
    } else {
      await interaction.respond([]);
    }
    return;
  }
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Эту команду можно использовать только на сервере',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const memberPerms = interaction.memberPermissions;
    if (!memberPerms || !memberPerms.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({
        content: 'Недостаточно прав для выполнения команды',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const existing = interaction.guild.channels.cache.find(
      c => c.name === CREATE_CHANNEL_NAME && c.type === ChannelType.GuildVoice
    ) as VoiceChannel | undefined;

    const existingInterface = interaction.guild.channels.cache.find(
      c => c.name === INTERFACE_CHANNEL_NAME && c.type === ChannelType.GuildText
    );

    if (existing) {
      await interaction.reply({ content: `Канал уже существует: ${existing}`, flags: MessageFlags.Ephemeral });
      return;
    }

    const interfaceChannel = existingInterface
      ? (existingInterface as TextChannel)
      : ((await interaction.guild.channels.create({
          name: INTERFACE_CHANNEL_NAME,
          type: ChannelType.GuildText
        })) as TextChannel);

    const channel = await interaction.guild.channels.create({
      name: CREATE_CHANNEL_NAME,
      type: ChannelType.GuildVoice
    });

    const legend = [
      `${ICON_PRIVACY} приватность`,
      `${ICON_RENAME} имя`,
      `${ICON_LIMIT} лимит`,
      `${ICON_DELETE} удалить`,
      `${ICON_INVITE} пригласить`,
      `${ICON_KICK} выгнать`,
      `${ICON_BLOCK} блок`,
      `${ICON_UNBLOCK} разблок`,
      `${ICON_TRUSTED_ADD} доверенный`,
      `${ICON_TRUSTED_REMOVE} убрать доверенного`,
      `${ICON_TRANSFER} лидер`
    ].join(' | ');

    const embed = new EmbedBuilder()
      .setTitle('Настройка временного канала')
      .setColor(0x00ff00)
      .setDescription(
        `Используйте кнопки ниже чтобы управлять созданным для вас голосовым каналом.\n${legend}`
      );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_privacy')
      .setEmoji(ICON_PRIVACY)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('rename')
      .setEmoji(ICON_RENAME)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('set_limit')
      .setEmoji(ICON_LIMIT)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('delete_channel')
      .setEmoji(ICON_DELETE)
      .setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('region')
      .setPlaceholder('Выберите регион')
      .addOptions(
        { label: 'Авто', value: 'auto' },
        { label: 'Европа', value: 'rotterdam' },
        { label: 'Сингапур', value: 'singapore' }
      )
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('invite_user')
      .setEmoji(ICON_INVITE)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('kick_user')
      .setEmoji(ICON_KICK)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('block_user')
      .setEmoji(ICON_BLOCK)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('unblock_user')
      .setEmoji(ICON_UNBLOCK)
      .setStyle(ButtonStyle.Secondary)
  );

  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('add_trusted')
      .setEmoji(ICON_TRUSTED_ADD)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('remove_trusted')
      .setEmoji(ICON_TRUSTED_REMOVE)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('transfer_leader')
      .setEmoji(ICON_TRANSFER)
      .setStyle(ButtonStyle.Secondary)
  );

  await interfaceChannel.send({ embeds: [embed], components: [row1, row2, row3, row4] });

    await interaction.reply({ content: `Создан канал ${channel} и ${interfaceChannel}`, flags: MessageFlags.Ephemeral });
  } else if (interaction.isChatInputCommand() && interaction.commandName === 'voice') {
    const sub = interaction.options.getSubcommand();
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: 'Вы должны находиться в своём временном канале',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    if (!isManager(channel.id, interaction.user.id)) {
      await interaction.reply({ content: 'Недостаточно прав', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'privacy') {
    const everyone = interaction.guild!.roles.everyone;
    const overwrite = channel.permissionOverwrites.resolve(everyone.id);
    const isPrivate = overwrite?.deny.has(PermissionFlagsBits.Connect);
    await channel.permissionOverwrites.edit(everyone, {
      Connect: isPrivate ? null : false
    });
    const number = channelNumbers.get(channel.id);
    if (number !== undefined) {
      const lock = isPrivate ? LOCK_OPEN : LOCK_CLOSED;
      await channel.setName(`[${lock}] ${TEMP_CHANNEL_PREFIX}[#${number}]`);
    }
    await interaction.reply({
      content: isPrivate ? 'Канал теперь публичный' : 'Канал теперь приватный',
      flags: MessageFlags.Ephemeral
    });
    } else if (sub === 'rename') {
      const name = interaction.options.getString('name', true);
      await channel.setName(name);
      await interaction.reply({ content: `Название канала изменено на ${name}`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'limit') {
      const limit = interaction.options.getInteger('limit', true);
      if (limit < 0 || limit > 99) {
        await interaction.reply({ content: 'Неверное значение', flags: MessageFlags.Ephemeral });
        return;
      }
      await channel.setUserLimit(limit);
      await interaction.reply({ content: `Лимит установлен: ${limit}`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'delete') {
      await channel.delete();
      createdChannels.delete(channel.id);
      channelOwners.delete(channel.id);
      trustedUsers.delete(channel.id);
      await interaction.reply({ content: 'Канал удалён', flags: MessageFlags.Ephemeral });
    } else if (sub === 'region') {
      const value = interaction.options.getString('region', true);
      await channel.setRTCRegion(value === 'auto' ? null : value);
      await interaction.reply({ content: `Регион канала установлен: ${value}`, flags: MessageFlags.Ephemeral });
    } else {
      const id = interaction.options.getString('user', true);
      const member = await interaction.guild?.members.fetch(id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: 'Пользователь не найден', flags: MessageFlags.Ephemeral });
        return;
      }
      if (sub === 'invite') {
        await channel.permissionOverwrites.edit(member, { Connect: true });
        await interaction.reply({ content: `Пользователь приглашён: ${member}`, flags: MessageFlags.Ephemeral });
      } else if (sub === 'kick') {
        if (member.voice.channelId !== channel.id) {
          await interaction.reply({ content: 'Пользователь не найден в канале', flags: MessageFlags.Ephemeral });
          return;
        }
        await member.voice.disconnect();
        await interaction.reply({ content: `Пользователь выгнан: ${member}`, flags: MessageFlags.Ephemeral });
      } else if (sub === 'block') {
        await channel.permissionOverwrites.edit(member, { Connect: false });
        await interaction.reply({ content: `Пользователь заблокирован: ${member}`, flags: MessageFlags.Ephemeral });
      } else if (sub === 'unblock') {
        await channel.permissionOverwrites.delete(member);
        await interaction.reply({ content: `Пользователь разблокирован: ${member}`, flags: MessageFlags.Ephemeral });
      } else if (sub === 'addtrusted') {
        const set = trustedUsers.get(channel.id) ?? new Set();
        set.add(id);
        trustedUsers.set(channel.id, set);
        await interaction.reply({ content: 'Доверенный пользователь добавлен', flags: MessageFlags.Ephemeral });
      } else if (sub === 'removetrusted') {
        trustedUsers.get(channel.id)?.delete(id);
        await interaction.reply({ content: 'Доверенный пользователь удалён', flags: MessageFlags.Ephemeral });
      } else if (sub === 'transfer') {
        channelOwners.set(channel.id, id);
        const set = trustedUsers.get(channel.id) ?? new Set();
        set.add(id);
        trustedUsers.set(channel.id, set);
        await interaction.reply({ content: 'Лидерство передано', flags: MessageFlags.Ephemeral });
      }
    }
  } else if (interaction.isButton()) {
    if (interaction.customId === 'toggle_privacy') {
      const channel = getUserTempChannel(interaction);
      if (!channel) {
        await interaction.reply({
          content: 'Вы должны находиться в своём временном канале',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      if (!isManager(channel.id, interaction.user.id)) {
        await interaction.reply({ content: 'Недостаточно прав', flags: MessageFlags.Ephemeral });
        return;
      }
      const everyone = interaction.guild!.roles.everyone;
      const overwrite = channel.permissionOverwrites.resolve(everyone.id);
      const isPrivate = overwrite?.deny.has(PermissionFlagsBits.Connect);
      await channel.permissionOverwrites.edit(everyone, {
        Connect: isPrivate ? null : false
      });
      const number = channelNumbers.get(channel.id);
      if (number !== undefined) {
        const lock = isPrivate ? LOCK_OPEN : LOCK_CLOSED;
        await channel.setName(`[${lock}] ${TEMP_CHANNEL_PREFIX}[#${number}]`);
      }
      await interaction.reply({
        content: isPrivate ? 'Канал теперь публичный' : 'Канал теперь приватный',
        flags: MessageFlags.Ephemeral
      });
    } else if (interaction.customId === 'rename') {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({ content: 'Недостаточно прав', flags: MessageFlags.Ephemeral });
        return;
      }
      const modal = new ModalBuilder().setCustomId('rename_modal').setTitle('Переименовать канал');

      const input = new TextInputBuilder()
        .setCustomId('name_input')
        .setLabel('Новое название')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
    } else if (interaction.customId === 'set_limit') {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({ content: 'Недостаточно прав', flags: MessageFlags.Ephemeral });
        return;
      }
      const modal = new ModalBuilder().setCustomId('limit_modal').setTitle('Лимит пользователей');

      const input = new TextInputBuilder()
        .setCustomId('limit_input')
        .setLabel('Число от 0 до 99')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
    } else if (interaction.customId === 'invite_user') {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({ content: 'Недостаточно прав', flags: MessageFlags.Ephemeral });
        return;
      }
      const modal = new ModalBuilder().setCustomId('invite_modal').setTitle('Пригласить пользователя');
      const input = new TextInputBuilder()
        .setCustomId('invite_input')
        .setLabel('ID пользователя или @')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
    } else if (interaction.customId === 'kick_user') {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({ content: 'Недостаточно прав', flags: MessageFlags.Ephemeral });
        return;
      }
      const modal = new ModalBuilder().setCustomId('kick_modal').setTitle('Выгнать пользователя');
      const input = new TextInputBuilder()
        .setCustomId('kick_input')
        .setLabel('ID пользователя или @')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
    } else if (interaction.customId === 'block_user') {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({ content: 'Недостаточно прав', flags: MessageFlags.Ephemeral });
        return;
      }
      const modal = new ModalBuilder().setCustomId('block_modal').setTitle('Заблокировать пользователя');
      const input = new TextInputBuilder()
        .setCustomId('block_input')
        .setLabel('ID пользователя или @')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
    } else if (interaction.customId === 'unblock_user') {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({ content: 'Недостаточно прав', flags: MessageFlags.Ephemeral });
        return;
      }
      const modal = new ModalBuilder().setCustomId('unblock_modal').setTitle('Разблокировать пользователя');
      const input = new TextInputBuilder()
        .setCustomId('unblock_input')
        .setLabel('ID пользователя или @')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
    } else if (interaction.customId === 'add_trusted') {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({ content: 'Недостаточно прав', flags: MessageFlags.Ephemeral });
        return;
      }
      const modal = new ModalBuilder().setCustomId('trusted_add_modal').setTitle('Добавить доверенного');
      const input = new TextInputBuilder()
        .setCustomId('trusted_input')
        .setLabel('ID пользователя или @')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
    } else if (interaction.customId === 'remove_trusted') {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({ content: 'Недостаточно прав', flags: MessageFlags.Ephemeral });
        return;
      }
      const modal = new ModalBuilder().setCustomId('trusted_remove_modal').setTitle('Убрать доверенного');
      const input = new TextInputBuilder()
        .setCustomId('trusted_input')
        .setLabel('ID пользователя или @')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
    } else if (interaction.customId === 'transfer_leader') {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({ content: 'Недостаточно прав', flags: MessageFlags.Ephemeral });
        return;
      }
      const modal = new ModalBuilder().setCustomId('transfer_modal').setTitle('Передать лидерство');
      const input = new TextInputBuilder()
        .setCustomId('transfer_input')
        .setLabel('ID пользователя или @')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
    } else if (interaction.customId === 'delete_channel') {
      const channel = getUserTempChannel(interaction);
      if (!channel || !isManager(channel.id, interaction.user.id)) {
        await interaction.reply({
          content: 'Вы должны находиться в своём временном канале',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      await channel.delete();
      createdChannels.delete(channel.id);
      channelOwners.delete(channel.id);
      trustedUsers.delete(channel.id);
      await interaction.reply({ content: 'Канал удалён', flags: MessageFlags.Ephemeral });
    }
  } else if (interaction.isStringSelectMenu() && interaction.customId === 'region') {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: 'Вы должны находиться в своём временном канале',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const value = interaction.values[0];
    await channel.setRTCRegion(value === 'auto' ? null : value);
    await interaction.reply({
      content: `Регион канала установлен: ${value}`,
      flags: MessageFlags.Ephemeral
    });
  } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'rename_modal') {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: 'Вы должны находиться в своём временном канале',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const name = interaction.fields.getTextInputValue('name_input');
    await channel.setName(name);
    await interaction.reply({ content: `Название канала изменено на ${name}`, flags: MessageFlags.Ephemeral });
  } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'limit_modal') {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({ content: 'Вы должны находиться в своём временном канале', flags: MessageFlags.Ephemeral });
      return;
    }
    const limit = parseInt(interaction.fields.getTextInputValue('limit_input'), 10);
    if (isNaN(limit) || limit < 0 || limit > 99) {
      await interaction.reply({ content: 'Неверное значение', flags: MessageFlags.Ephemeral });
      return;
    }
    await channel.setUserLimit(limit);
    await interaction.reply({ content: `Лимит установлен: ${limit}`, flags: MessageFlags.Ephemeral });
  } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'invite_modal') {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({ content: 'Вы должны находиться в своём временном канале', flags: MessageFlags.Ephemeral });
      return;
    }
    const id = interaction.fields.getTextInputValue('invite_input').replace(/[^0-9]/g, '');
    const member = await interaction.guild?.members.fetch(id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'Пользователь не найден', flags: MessageFlags.Ephemeral });
      return;
    }
    await channel.permissionOverwrites.edit(member, { Connect: true });
    await interaction.reply({ content: `Пользователь приглашён: ${member}`, flags: MessageFlags.Ephemeral });
  } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'kick_modal') {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({ content: 'Вы должны находиться в своём временном канале', flags: MessageFlags.Ephemeral });
      return;
    }
    const id = interaction.fields.getTextInputValue('kick_input').replace(/[^0-9]/g, '');
    const member = await interaction.guild?.members.fetch(id).catch(() => null);
    if (!member || member.voice.channelId !== channel.id) {
      await interaction.reply({ content: 'Пользователь не найден в канале', flags: MessageFlags.Ephemeral });
      return;
    }
    await member.voice.disconnect();
    await interaction.reply({ content: `Пользователь выгнан: ${member}`, flags: MessageFlags.Ephemeral });
  } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'block_modal') {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({ content: 'Вы должны находиться в своём временном канале', flags: MessageFlags.Ephemeral });
      return;
    }
    const id = interaction.fields.getTextInputValue('block_input').replace(/[^0-9]/g, '');
    const member = await interaction.guild?.members.fetch(id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'Пользователь не найден', flags: MessageFlags.Ephemeral });
      return;
    }
    await channel.permissionOverwrites.edit(member, { Connect: false });
    await interaction.reply({ content: `Пользователь заблокирован: ${member}`, flags: MessageFlags.Ephemeral });
  } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'unblock_modal') {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({ content: 'Вы должны находиться в своём временном канале', flags: MessageFlags.Ephemeral });
      return;
    }
    const id = interaction.fields.getTextInputValue('unblock_input').replace(/[^0-9]/g, '');
    const member = await interaction.guild?.members.fetch(id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'Пользователь не найден', flags: MessageFlags.Ephemeral });
      return;
    }
    await channel.permissionOverwrites.delete(member);
    await interaction.reply({ content: `Пользователь разблокирован: ${member}`, flags: MessageFlags.Ephemeral });
  } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'trusted_add_modal') {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({ content: 'Вы должны находиться в своём временном канале', flags: MessageFlags.Ephemeral });
      return;
    }
    const id = interaction.fields.getTextInputValue('trusted_input').replace(/[^0-9]/g, '');
    const set = trustedUsers.get(channel.id) ?? new Set();
    set.add(id);
    trustedUsers.set(channel.id, set);
    await interaction.reply({ content: 'Доверенный пользователь добавлен', flags: MessageFlags.Ephemeral });
  } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'trusted_remove_modal') {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({ content: 'Вы должны находиться в своём временном канале', flags: MessageFlags.Ephemeral });
      return;
    }
    const id = interaction.fields.getTextInputValue('trusted_input').replace(/[^0-9]/g, '');
    trustedUsers.get(channel.id)?.delete(id);
    await interaction.reply({ content: 'Доверенный пользователь удалён', flags: MessageFlags.Ephemeral });
  } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'transfer_modal') {
    const channel = getUserTempChannel(interaction);
    if (!channel) {
      await interaction.reply({ content: 'Вы должны находиться в своём временном канале', flags: MessageFlags.Ephemeral });
      return;
    }
    const id = interaction.fields.getTextInputValue('transfer_input').replace(/[^0-9]/g, '');
    channelOwners.set(channel.id, id);
    const set = trustedUsers.get(channel.id) ?? new Set();
    set.add(id);
    trustedUsers.set(channel.id, set);
    await interaction.reply({ content: 'Лидерство передано', flags: MessageFlags.Ephemeral });
  }

}
