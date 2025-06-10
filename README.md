# Corpa Activity Web

Пример веб-приложения на Express, которое отправляет активность в Discord с помощью Discord Social SDK (`discord-gamesdk`).

## Установка и запуск

1. Установите зависимости `express` и `dotenv`:
   ```bash
   pnpm install
   ```
2. Скачайте архив с Discord Social SDK из [портала разработчика](https://discord.com/developers/docs/discord-social-sdk/overview) и распакуйте его.
   Внутри архива находится пакет `discord-gamesdk.tgz`. Установите его локально:
   ```bash
   pnpm install ./path/to/discord-gamesdk.tgz
   ```
3. Создайте файл `.env` и пропишите в нём `DISCORD_CLIENT_ID=<ваш client id>`.
4. Скомпилируйте TypeScript и запустите сервер:
   ```bash
   pnpm run build
   pnpm start
   ```

Сервер слушает порт `3000` (или переменную `PORT`). Перейдите по маршруту `/update`, чтобы обновить активность.
