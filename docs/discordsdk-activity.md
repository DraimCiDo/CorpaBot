# Использование DiscordSDK для активности

Этот документ описывает пример интеграции Discord Game SDK (DiscordSDK) для отображения активности в клиенте Discord и шаги по подключению вашего приложения в [Developer Portal](https://discord.com/developers/applications).

## Установка зависимостей

Для работы с DiscordSDK используется npm-пакет `discord-gamesdk`. Добавьте его в зависимости проекта:

```bash
pnpm add discord-gamesdk
```

> **Важно:** пакет включает бинарные файлы SDK. Убедитесь, что в системе присутствуют соответствующие библиотеки (для Windows `discord_game_sdk.dll`, для Linux `libdiscord_game_sdk.so`). Их можно получить из архива [Discord Game SDK](https://discord.com/developers/docs/game-sdk/sdk-starter-guide).

## Минимальный пример

Создайте файл `src/activity.ts` и добавьте в него следующий код:

```ts
import { DiscordSDK, CreateFlags, ActivityType } from 'discord-gamesdk';
import dotenv from 'dotenv';

dotenv.config();

const clientId = process.env.DISCORD_CLIENT_ID;
if (!clientId) {
  throw new Error('DISCORD_CLIENT_ID not set');
}

// Инициализируем SDK
const discord = new DiscordSDK({ clientId: clientId, flags: CreateFlags.NoRequireDiscord });

async function run() {
  await discord.connect();

  await discord.activityManager.updateActivity({
    state: 'Запущен CorpaBot',
    details: 'Пример активности из DiscordSDK',
    type: ActivityType.Playing,
    timestamps: { start: Date.now() }
  });

  console.log('Activity updated');
}

run().catch(console.error);
```

Компилируйте TypeScript и запускайте скрипт:

```bash
pnpm run build
node dist/activity.js
```

При успешном выполнении в клиенте Discord отобразится активность приложения.

## Настройка приложения в Developer Portal

1. Перейдите на страницу <https://discord.com/developers/applications> и создайте новое приложение.
2. Скопируйте `Client ID` и пропишите его в переменной окружения `DISCORD_CLIENT_ID`.
3. На вкладке **Rich Presence** загрузите изображения, которые будут использоваться в активности.
4. На вкладке **OAuth2** добавьте URI перенаправления, если планируете авторизацию.
5. Сохраните изменения и запустите приложение. DiscordSDK подключится к созданному приложению и сможет отображать активность.

Теперь ваш бот может показывать кастомную активность в профиле пользователя через DiscordSDK.
