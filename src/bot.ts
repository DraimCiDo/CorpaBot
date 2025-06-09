import {
  Client,
  GatewayIntentBits,
  VoiceChannel,
  CategoryChannel,
  ChannelType,
  PermissionFlagsBits
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

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'setup') {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Эту команду можно использовать только на сервере',
        ephemeral: true
      });
      return;
    }

    const memberPerms = interaction.memberPermissions;
    if (!memberPerms || !memberPerms.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({
        content: 'Недостаточно прав для выполнения команды',
        ephemeral: true
      });
      return;
    }

    const existing = interaction.guild.channels.cache.find(
      c => c.name === CREATE_CHANNEL_NAME && c.type === ChannelType.GuildVoice
    ) as VoiceChannel | undefined;

    if (existing) {
      await interaction.reply({ content: `Канал уже существует: ${existing}`, ephemeral: true });
      return;
    }

    const channel = await interaction.guild.channels.create({
      name: CREATE_CHANNEL_NAME,
      type: ChannelType.GuildVoice
    });

    await interaction.reply({ content: `Создан канал ${channel}`, ephemeral: true });
  }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  // Create a temporary voice channel when user joins the create channel
  if (newState.channel && newState.channel.name === CREATE_CHANNEL_NAME) {
    const category = newState.channel.parent as CategoryChannel | null;
    const newChannel = await newState.guild.channels.create({
      name: `${TEMP_CHANNEL_PREFIX}${newState.member?.displayName ?? 'user'}`,
      type: 2, // GUILD_VOICE
      parent: category ?? undefined
    });
    createdChannels.add(newChannel.id);
    await newState.setChannel(newChannel as VoiceChannel);
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
