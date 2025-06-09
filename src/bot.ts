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
  VoiceChannel
} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const CREATE_CHANNEL_NAME = 'Создать канал';
const TEMP_CHANNEL_PREFIX = 'Канал ';

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

    if (existing) {
      await interaction.reply({ content: `Канал уже существует: ${existing}`, flags: MessageFlags.Ephemeral });
      return;
    }

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
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('region')
        .setPlaceholder('Выберите регион')
        .addOptions(
          { label: 'Авто', value: 'auto' },
          { label: 'Россия', value: 'russia' },
          { label: 'Европа', value: 'europe' }
        )
    );

    await interaction.channel?.send({ embeds: [embed], components: [row1, row2] });

    await interaction.reply({ content: `Создан канал ${channel}`, flags: MessageFlags.Ephemeral });
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
      const modal = new ModalBuilder().setCustomId('rename_modal').setTitle('Переименовать канал');

      const input = new TextInputBuilder()
        .setCustomId('name_input')
        .setLabel('Новое название')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
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
    await newState.setChannel(newChannel);
  }

  // Delete temporary voice channel if it becomes empty
  if (oldState.channel && createdChannels.has(oldState.channel.id)) {
    if (oldState.channel.members.size === 0) {
      createdChannels.delete(oldState.channel.id);
      await oldState.channel.delete();
    }
  }
});

client.login(token);
