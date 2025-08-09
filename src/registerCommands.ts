// Регистрация slash-команд, которые используются на сервере.
import { Client } from "discord.js";

// Создаёт необходимые slash-команды у приложения Discord.
export async function registerCommands(client: Client): Promise<void> {
  // `/setup` — создаёт служебные каналы для работы временных комнат.
  await client.application?.commands.create({
    name: "setup",
    description: "Создает канал для управления временными каналами",
  });

  // `/interface` — заново публикует сообщение с кнопками управления.
  await client.application?.commands.create({
    name: "interface",
    description: "Обновляет сообщение в канале Интерфейс",
  });
}
