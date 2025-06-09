import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CategoryChannel,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Interaction,
  InteractionType,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  VoiceChannel,
  TextChannel
} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const CREATE_CHANNEL_NAME = 'Создать канал';
const TEMP_CHANNEL_PREFIX = 'Канал ';
const INTERFACE_CHANNEL_NAME = 'Интерфейс';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error('DISCORD_TOKEN environment variable not set');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

client.once('ready', async () => {
  // Register the /setup slash command when the bot starts
  await client.application?.commands.create({
    name: 'setup',
    description: 'Создает канал для управления временными каналами'
  });
  console.log('Bot ready');
});

const createdChannels = new Set<string>();
const channelOwners = new Map<string, string>();
const trustedUsers = new Map<string, Set<string>>();

function isManager(channelId: string, userId: string): boolean {
  return (
    channelOwners.get(channelId) === userId ||
    trustedUsers.get(channelId)?.has(userId) === true
  );
}

function getUserTempChannel(interaction: Interaction): VoiceChannel | null {
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const channel = member?.voice.channel as VoiceChannel | null | undefined;
  if (channel && createdChannels.has(channel.id)) {
    return channel;
  }
  return null;
}

client.on('interactionCreate', async interaction => {
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

    const embed = new EmbedBuilder()
      .setTitle('Настройка временного канала')
      .setDescription(
        'Используйте кнопки ниже чтобы управлять созданным для вас голосовым каналом.'
      );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_privacy')
      .setLabel('Приватность')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('rename')
      .setLabel('Переименовать')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('set_limit')
      .setLabel('Лимит')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('delete_channel')
      .setLabel('Удалить')
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
      .setLabel('Пригласить')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('kick_user')
      .setLabel('Выгнать')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('block_user')
      .setLabel('Заблокировать')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('unblock_user')
      .setLabel('Разблокировать')
      .setStyle(ButtonStyle.Secondary)
  );

  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('add_trusted')
      .setLabel('Доверенный')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('remove_trusted')
      .setLabel('Убрать доверенного')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('transfer_leader')
      .setLabel('Передать лидера')
      .setStyle(ButtonStyle.Secondary)
  );

  await interfaceChannel.send({ embeds: [embed], components: [row1, row2, row3, row4] });

    await interaction.reply({ content: `Создан канал ${channel} и ${interfaceChannel}`, flags: MessageFlags.Ephemeral });
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
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  // Create a temporary voice channel when user joins the create channel
  if (newState.channel && newState.channel.name === CREATE_CHANNEL_NAME) {
    const category = newState.channel.parent as CategoryChannel | null;
    const newChannel = (await newState.guild.channels.create({
      name: `${TEMP_CHANNEL_PREFIX}${newState.member?.displayName ?? 'user'}`,
      type: ChannelType.GuildVoice,
      parent: category ?? undefined
    })) as VoiceChannel;
    createdChannels.add(newChannel.id);
    channelOwners.set(newChannel.id, newState.id);
    trustedUsers.set(newChannel.id, new Set([newState.id]));
    await newState.setChannel(newChannel);
  }

  // Delete temporary voice channel if it becomes empty
  if (oldState.channel && createdChannels.has(oldState.channel.id)) {
    if (oldState.channel.members.size === 0) {
      createdChannels.delete(oldState.channel.id);
      channelOwners.delete(oldState.channel.id);
      trustedUsers.delete(oldState.channel.id);
      await oldState.channel.delete();
    } else {
      const ownerId = channelOwners.get(oldState.channel.id);
      if (ownerId === oldState.id) {
        const [first] = oldState.channel.members.values();
        if (first) {
          channelOwners.set(oldState.channel.id, first.id);
        }
      }
    }
  }
});

client.login(token);
