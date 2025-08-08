import { Client } from "discord.js";

export async function registerCommands(client: Client): Promise<void> {
  await client.application?.commands.create({
    name: "setup",
    description: "Создает канал для управления временными каналами",
  });

  await client.application?.commands.create({
    name: "interface",
    description: "Обновляет сообщение в канале Интерфейс",
  });

}
