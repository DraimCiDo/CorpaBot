# Использование Discord Social SDK

Этот документ описывает запуск веб-приложения, которое отправляет кастомную активность в Discord.

1. Установите зависимости `discord-gamesdk` и `express`:
   ```bash
   pnpm add express discord-gamesdk
   ```
2. Укажите `DISCORD_CLIENT_ID` в `.env`.
3. Запускайте сервер командой `pnpm start` и открывайте `/update`, чтобы увидеть активность.
