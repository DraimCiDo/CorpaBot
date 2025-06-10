# Использование Discord Social SDK

Этот документ описывает запуск веб-приложения, которое отправляет кастомную активность в Discord.

1. Установите зависимости проекта:
   ```bash
   pnpm install
   ```
2. Скачайте архив Discord Social SDK из портала разработчика и найдите в нём файл `discord-gamesdk.tgz`. Установите этот пакет локально:
   ```bash
   pnpm install ./path/to/discord-gamesdk.tgz
   ```
3. Укажите `DISCORD_CLIENT_ID` в `.env`.
4. Запускайте сервер командой `pnpm start` и открывайте `/update`, чтобы увидеть активность.
