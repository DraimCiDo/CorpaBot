# Corpa Activity Web

Пример веб-приложения на Express, которое отправляет активность в Discord с помощью Discord Social SDK (`discord-gamesdk`).

## Установка и запуск

1. Установите зависимости с помощью [pnpm](https://pnpm.io):
   ```bash
   pnpm install
   ```
2. Создайте файл `.env` и пропишите в нём `DISCORD_CLIENT_ID=<ваш client id>`.
3. Скомпилируйте TypeScript и запустите сервер:
   ```bash
   pnpm run build
   pnpm start
   ```

Сервер слушает порт `3000` (или переменную `PORT`). Перейдите по маршруту `/update`, чтобы обновить активность.
