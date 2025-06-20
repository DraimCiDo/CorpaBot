import { client, login } from "./client";
import { registerCommands } from "./registerCommands";
import { handleInteraction } from "./handlers/interactions";
import { handleVoiceStateUpdate } from "./voice";

client.once("ready", async () => {
  await registerCommands(client);
  console.log("Bot ready");
});

client.on("interactionCreate", handleInteraction);
client.on("voiceStateUpdate", handleVoiceStateUpdate);

login();
