import { DiscordSDK, CreateFlags, ActivityType } from 'discord-gamesdk';
import dotenv from 'dotenv';

dotenv.config();

const clientId = process.env.DISCORD_CLIENT_ID;
if (!clientId) {
  throw new Error('DISCORD_CLIENT_ID not set');
}

const discord = new DiscordSDK({ clientId, flags: CreateFlags.NoRequireDiscord });

async function main() {
  await discord.connect();
  await discord.activityManager.updateActivity({
    state: 'Запущен CorpaBot',
    details: 'Пример активности из DiscordSDK',
    type: ActivityType.Playing,
    timestamps: { start: Date.now() }
  });
  console.log('Activity updated');
}

main().catch(console.error);
