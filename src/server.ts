import express from 'express';
import { DiscordSDK, CreateFlags, ActivityType } from 'discord-gamesdk';
import dotenv from 'dotenv';

dotenv.config();

const clientId = process.env.DISCORD_CLIENT_ID;
if (!clientId) {
  throw new Error('DISCORD_CLIENT_ID not set');
}

const discord = new DiscordSDK({ clientId, flags: CreateFlags.NoRequireDiscord });
const app = express();
const port = process.env.PORT || 3000;

app.get('/update', async (_req, res) => {
  try {
    await discord.activityManager.updateActivity({
      state: 'Running Activity Web App',
      details: 'Example presence from web server',
      type: ActivityType.Playing,
      timestamps: { start: Date.now() }
    });
    res.send('Activity updated');
  } catch (error) {
    res.status(500).send(String(error));
  }
});

async function start() {
  await discord.connect();
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});
