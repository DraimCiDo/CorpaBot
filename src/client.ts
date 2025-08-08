// Инициализация клиента Discord и загрузка переменных окружения.
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";

// Загружаем переменные окружения из файла .env, если он существует.
dotenv.config();

// Токен бота берётся из переменной окружения DISCORD_TOKEN.
// Без него запуск невозможен.
const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error("DISCORD_TOKEN environment variable not set");
}

// Создаём экземпляр клиента Discord и указываем, какие события нам нужны.
export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// Отдельная функция для авторизации бота, чтобы можно было вызывать её извне.
export function login() {
  return client.login(token);
}
