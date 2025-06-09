import { Client, GatewayIntentBits, VoiceChannel, CategoryChannel } from 'discord.js';
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

const createdChannels = new Set<string>();

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
