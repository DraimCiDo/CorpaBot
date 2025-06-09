import { Client, ApplicationCommandOptionType } from 'discord.js';

export async function registerCommands(client: Client): Promise<void> {
  await client.application?.commands.create({
    name: 'setup',
    description: 'Создает канал для управления временными каналами'
  });

  await client.application?.commands.create({
    name: 'interface',
    description: 'Обновляет сообщение в канале Интерфейс'
  });

  await client.application?.commands.create({
    name: 'voice',
    description: 'Управление временным голосовым каналом',
    options: [
      { name: 'privacy', description: 'Переключить приватность', type: ApplicationCommandOptionType.Subcommand },
      {
        name: 'rename',
        description: 'Переименовать канал',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'name', description: 'Новое имя', type: ApplicationCommandOptionType.String, required: true }
        ]
      },
      {
        name: 'limit',
        description: 'Установить лимит пользователей',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'limit', description: 'Число от 0 до 99', type: ApplicationCommandOptionType.Integer, required: true }
        ]
      },
      { name: 'delete', description: 'Удалить канал', type: ApplicationCommandOptionType.Subcommand },
      {
        name: 'region',
        description: 'Установить регион',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'region',
            description: 'Регион',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: 'Авто', value: 'auto' },
              { name: 'Европа', value: 'rotterdam' },
              { name: 'Сингапур', value: 'singapore' }
            ]
          }
        ]
      },
      {
        name: 'invite',
        description: 'Пригласить пользователя',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'user', description: 'Пользователь', type: ApplicationCommandOptionType.String, required: true, autocomplete: true }
        ]
      },
      {
        name: 'kick',
        description: 'Выгнать пользователя',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'user', description: 'Пользователь', type: ApplicationCommandOptionType.String, required: true, autocomplete: true }
        ]
      },
      {
        name: 'block',
        description: 'Заблокировать пользователя',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'user', description: 'Пользователь', type: ApplicationCommandOptionType.String, required: true, autocomplete: true }
        ]
      },
      {
        name: 'unblock',
        description: 'Разблокировать пользователя',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'user', description: 'Пользователь', type: ApplicationCommandOptionType.String, required: true, autocomplete: true }
        ]
      },
      {
        name: 'addtrusted',
        description: 'Добавить доверенного пользователя',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'user', description: 'Пользователь', type: ApplicationCommandOptionType.String, required: true, autocomplete: true }
        ]
      },
      {
        name: 'removetrusted',
        description: 'Убрать доверенного пользователя',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'user', description: 'Пользователь', type: ApplicationCommandOptionType.String, required: true, autocomplete: true }
        ]
      },
      {
        name: 'transfer',
        description: 'Передать лидерство',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'user', description: 'Пользователь', type: ApplicationCommandOptionType.String, required: true, autocomplete: true }
        ]
      }
    ]
  });
}
