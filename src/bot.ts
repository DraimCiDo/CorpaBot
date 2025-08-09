// Главный файл бота: подключает клиента, регистрирует команды
// и навешивает обработчики событий Discord.

// Инициализированный клиент и функция логина.
import { client, login } from "./client";
// Регистрация slash-команд при запуске.
import { registerCommands } from "./registerCommands";
// Обработчик всех взаимодействий (кнопки, меню, команды).
import { handleInteraction } from "./handlers/interactions";
// Логика создания и удаления временных голосовых каналов.
import { handleVoiceStateUpdate } from "./voice";

// Событие наступает один раз после полной готовности бота.
client.once("ready", async () => {
  // Регистрируем необходимые команды у приложения.
  await registerCommands(client);
  console.log("Bot ready");
});

// Обработка всех взаимодействий пользователей со slash-командами,
// кнопками, модальными окнами и т.д.
client.on("interactionCreate", handleInteraction);
// Отслеживание входа/выхода из голосовых каналов для работы
// временных комнат.
client.on("voiceStateUpdate", handleVoiceStateUpdate);

// Запуск авторизации бота с использованием токена из окружения.
login();
