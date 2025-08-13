// Обработчики slash-команд, кнопок и других взаимодействий Discord.
// Здесь реализована логика управления временными каналами через интерфейс.
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Interaction,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
  CategoryChannel,
  MessageFlags,
} from "discord.js";
import {
  CREATE_CHANNEL_NAME,
  INTERFACE_CHANNEL_NAME,
  VOICE_CATEGORY_NAME,
  ICON_PRIVACY,
  ICON_RENAME,
  ICON_LIMIT,
  ICON_REGION,
  ICON_DELETE,
  ICON_INVITE,
  ICON_KICK,
  ICON_BLOCK,
  ICON_UNBLOCK,
  ICON_TRUSTED_ADD,
  ICON_TRUSTED_REMOVE,
  ICON_TRANSFER,
} from "../constants";
import {
  createdChannels,
  channelOwners,
  trustedUsers,
  channelNumbers,
  channelNames,
  availableNumbers,
} from "../state";
import {
  persistRename,
  persistPrivacy,
  persistRtcRegion,
  persistUserLimit,
  addTrustedLocalAndDB,
  removeTrustedLocalAndDB,
} from "../voice";
import { isManager, getUserTempChannel, formatChannelName } from "../voice";

// Вспомогательная функция для отправки скрытых (ephemeral) сообщений.
const ephemeral = (content: string) => ({
  content,
  flags: MessageFlags.Ephemeral as number,
});

// Отправляет в текстовый канал сообщение с кнопками управления.
async function sendInterfaceMessage(channel: TextChannel) {
  // Встраиваемое сообщение с кратким описанием.
  const embed = new EmbedBuilder()
    .setTitle("Настройка временного канала")
    .setColor(0x00ff00)
    .setDescription(
      "Используйте кнопки ниже чтобы управлять созданным для вас голосовым каналом."
    )
    .setImage(
      "https://cdn.discordapp.com/attachments/1148739831594242211/1381962774590132234/NEUKRAL2004.png?ex=68569ba1&is=68554a21&hm=c258a72a5a3406357054ede7d23ad573639576ea9a00338a745bbd869d947073&"
    );

  // Удобный конструктор строк кнопок.
  const makeRow = (
    btns: [string, string, ButtonStyle][]
  ) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      btns.map(([id, emoji, style]) =>
        new ButtonBuilder().setCustomId(id).setEmoji(emoji).setStyle(style)
      )
    );

  // Три строки кнопок управления каналом.
  const rows = [
    makeRow([
      ["toggle_privacy", ICON_PRIVACY, ButtonStyle.Primary],
      ["rename", ICON_RENAME, ButtonStyle.Secondary],
      ["set_limit", ICON_LIMIT, ButtonStyle.Secondary],
      ["change_region", ICON_REGION, ButtonStyle.Secondary],
      ["delete_channel", ICON_DELETE, ButtonStyle.Danger],
    ]),
    makeRow([
      ["invite_user", ICON_INVITE, ButtonStyle.Secondary],
      ["kick_user", ICON_KICK, ButtonStyle.Secondary],
      ["block_user", ICON_BLOCK, ButtonStyle.Secondary],
      ["unblock_user", ICON_UNBLOCK, ButtonStyle.Secondary],
    ]),
    makeRow([
      ["add_trusted", ICON_TRUSTED_ADD, ButtonStyle.Secondary],
      ["remove_trusted", ICON_TRUSTED_REMOVE, ButtonStyle.Secondary],
      ["transfer_leader", ICON_TRANSFER, ButtonStyle.Secondary],
    ]),
  ];

  await channel.send({ embeds: [embed], components: rows });
}

// Список регионов, доступных для голосовых каналов RTC.
// Используется для выбора региона при создании или изменении канала.
const ALLOWED_RTC_REGIONS = [
  "brazil",
  "hongkong",
  "india",
  "japan",
  "rotterdam",
  "singapore",
  "south-korea",
  "southafrica",
  "sydney",
  "us-central",
  "us-east",
  "us-south",
  "us-west",
 ] as const;

// Обработчики команд и взаимодействий.
async function handleSetup(inter: ChatInputCommandInteraction) {
  // Проверяем, что команда вызвана на сервере.
  if (!inter.guild)
    return inter.reply(
      ephemeral("Эту команду можно использовать только на сервере")
    );
  // Требуются права на управление каналами.
  if (!inter.memberPermissions?.has(PermissionFlagsBits.ManageChannels))
    return inter.reply(ephemeral("Недостаточно прав для выполнения команды"));

  // Если канал "Создать канал" уже есть, сообщаем об этом.
  const existing = inter.guild.channels.cache.find(
    (c: any) =>
      c.name === CREATE_CHANNEL_NAME && c.type === ChannelType.GuildVoice
  );
  if (existing)
    return inter.reply(ephemeral(`Канал уже существует: ${existing}`));

  // Ищем или создаём категорию для голосовых каналов.
  const category =
    (inter.guild.channels.cache.find(
      (c: any) =>
        c.name === VOICE_CATEGORY_NAME && c.type === ChannelType.GuildCategory
    ) as CategoryChannel) ||
    (await inter.guild.channels.create({
      name: VOICE_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
    }));

  // Ищем или создаём текстовый канал управления.
  const interfaceChannel =
    (inter.guild.channels.cache.find(
      (c: any) =>
        c.name === INTERFACE_CHANNEL_NAME && c.type === ChannelType.GuildText
    ) as TextChannel) ||
    ((await inter.guild.channels.create({
      name: INTERFACE_CHANNEL_NAME,
      type: ChannelType.GuildText,
      parent: category.id,
    })) as TextChannel);

  // Убеждаемся, что текстовый канал находится в нужной категории.
  if (interfaceChannel.parentId !== category.id)
    await interfaceChannel.setParent(category.id);

  // Создаём голосовой канал "Создать канал".
  const channel = await inter.guild.channels.create({
    name: CREATE_CHANNEL_NAME,
    type: ChannelType.GuildVoice,
    parent: category.id,
  });

  // Отправляем сообщение-интерфейс и уведомляем пользователя.
  await sendInterfaceMessage(interfaceChannel);
  await inter.reply(
    ephemeral(`Создан канал ${channel} и ${interfaceChannel}`)
  );
}

async function handleInterface(inter: ChatInputCommandInteraction) {
  // Аналогичные проверки, что команда выполняется на сервере администратором.
  if (!inter.guild)
    return inter.reply(
      ephemeral("Эту команду можно использовать только на сервере")
    );
  if (!inter.memberPermissions?.has(PermissionFlagsBits.ManageChannels))
    return inter.reply(ephemeral("Недостаточно прав для выполнения команды"));

  // Находим канал "Интерфейс" и переотправляем сообщение.
  const interfaceChannel = inter.guild.channels.cache.find(
    (c: any) =>
      c.name === INTERFACE_CHANNEL_NAME && c.type === ChannelType.GuildText
  ) as TextChannel | undefined;
  if (!interfaceChannel)
    return inter.reply(ephemeral("Канал Интерфейс не найден"));

  await sendInterfaceMessage(interfaceChannel);
  await inter.reply(ephemeral("Сообщение обновлено"));
}

async function withChannel(
  inter:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | StringSelectMenuInteraction
    | UserSelectMenuInteraction,
  requireManager = true
) {
  // Определяем временный канал пользователя и проверяем его права.
  const channel = getUserTempChannel(inter);
  if (!channel) {
    await inter.reply(ephemeral("Вы должны находиться в своём временном канале"));
    return null;
  }
  if (requireManager && !isManager(channel.id, inter.user.id)) {
    await inter.reply(ephemeral("Недостаточно прав"));
    return null;
  }
  return channel;
}

async function handleButton(inter: ButtonInteraction) {
  // Обработка нажатий на кнопки из интерфейсного сообщения.
  switch (inter.customId) {
    case "toggle_privacy": {
      const channel = await withChannel(inter);
      if (!channel) break;

      const everyone = inter.guild!.roles.everyone;
      const overwrite = channel.permissionOverwrites.resolve(everyone.id);
      const isPrivate = overwrite?.deny.has(PermissionFlagsBits.Connect);

      await channel.permissionOverwrites.edit(everyone, {
        Connect: isPrivate ? null : false,
      });

      await persistPrivacy(channel, !isPrivate); // <-- сохраняем в БД + обновляем имя
      await inter.reply(
        ephemeral(isPrivate ? "Канал теперь публичный" : "Канал теперь приватный")
      );
      break;
    }
    case "rename": {
      // Открываем модальное окно для переименования.
      const channel = await withChannel(inter);
      if (!channel) break;
      const modal = new ModalBuilder()
        .setCustomId("rename_modal")
        .setTitle("Переименовать канал")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("name_input")
              .setLabel("Новое название")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );
      await inter.showModal(modal);
      break;
    }
    case "set_limit": {
      // Модальное окно для установки лимита пользователей.
      const channel = await withChannel(inter);
      if (!channel) break;
      const modal = new ModalBuilder()
        .setCustomId("limit_modal")
        .setTitle("Лимит пользователей")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("limit_input")
              .setLabel("Число от 0 до 99")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );
      await inter.showModal(modal);
      break;
    }
    case "change_region": {
      // Выбор региона канала через выпадающее меню.
      const channel = await withChannel(inter);
      if (!channel) break;
      const menu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("region_select")
          .setPlaceholder("Выберите регион")
          .addOptions(
            { label: "Авто", value: "auto" },
            { label: "Вротдам", value: "rotterdam" },
            { label: "Сингапур", value: "singapore" },
            { label: "Токио-Дрифт", value: "japan" }
          )
      );
      await inter.reply({
        content: "Выберите регион",
        components: [menu],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }
    case "invite_user":
    case "kick_user":
    case "block_user":
    case "unblock_user":
    case "add_trusted":
    case "remove_trusted":
    case "transfer_leader": {
      // Общий сценарий: показываем меню выбора пользователя.
      const channel = await withChannel(inter);
      if (!channel) break;
      const ids: Record<string, string> = {
        invite_user: "invite_select",
        kick_user: "kick_select",
        block_user: "block_select",
        unblock_user: "unblock_select",
        add_trusted: "trusted_add_select",
        remove_trusted: "trusted_remove_select",
        transfer_leader: "transfer_select",
      };
      const menu = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(ids[inter.customId])
          .setPlaceholder("Выберите пользователя")
          .setMaxValues(1)
          .setMinValues(1)
      );
      await inter.reply({
        content: "Выберите пользователя",
        components: [menu],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }
    case "delete_channel": {
      const channel = await withChannel(inter);
      if (!channel) break;
      try { await channel.delete(); } catch {}
      // локальное состояние + БД очистятся в voiceStateUpdate, но на всякий случай:
      import("../db").then(({ deleteChannel }) => deleteChannel(channel.id));
      await inter.reply(ephemeral("Канал удалён"));
      break;
    }
  }
}

async function handleRegionSelect(inter: StringSelectMenuInteraction) {
  if (inter.customId !== "region_select") return;
  const channel = await withChannel(inter, false);
  if (!channel) return;

  const value = inter.values[0];
  await channel.setRTCRegion(value === "auto" ? null : value);
  persistRtcRegion(channel.id, value === "auto" ? null : value); // <-- в БД

  await inter.reply(ephemeral(`Регион канала установлен: ${value}`));
}

async function handleModal(inter: ModalSubmitInteraction) {
  // Обработка модальных окон после подтверждения пользователем.
  await inter.deferReply({ flags: MessageFlags.Ephemeral });
  const channel = getUserTempChannel(inter);
  if (!channel)
    return inter.editReply({
      content: "Вы должны находиться в своём временном канале",
    });
  switch (inter.customId) {
    case "rename_modal": {
      const name = inter.fields.getTextInputValue("name_input");
      await persistRename(channel, name); // <-- сохраняем в БД + меняем имя
      await inter.editReply({ content: `Название канала изменено на ${name}` });
      break;
    }
    case "limit_modal": {
      const limit = parseInt(inter.fields.getTextInputValue("limit_input"), 10);
      if (isNaN(limit) || limit < 0 || limit > 99)
        return inter.editReply({ content: "Неверное значение" });

      await channel.setUserLimit(limit);
      persistUserLimit(channel.id, limit); // <-- в БД
      await inter.editReply({ content: `Лимит установлен: ${limit}` });
      break;
    }
  }
}

async function handleUserSelect(inter: UserSelectMenuInteraction) {
  // Пользователь выбран из меню; выполняем соответствующее действие.
  const channel = await withChannel(inter);
  if (!channel) return;
  const id = inter.values[0];
  const member = await inter.guild?.members.fetch(id).catch(() => null);
  if (!member) return inter.reply(ephemeral("Пользователь не найден"));

  switch (inter.customId) {
    case "invite_select":
      await channel.permissionOverwrites.edit(member, { Connect: true });
      addTrustedLocalAndDB(channel.id, member.id); // логично отмечать как trusted
      await inter.reply(ephemeral(`Пользователь приглашён: ${member}`));
      break;
    case "kick_select":
      if (member.voice.channelId !== channel.id)
        return inter.reply(ephemeral("Пользователь не найден в канале"));
      await member.voice.disconnect();
      await inter.reply(ephemeral(`Пользователь выгнан: ${member}`));
      break;
    case "block_select":
      await channel.permissionOverwrites.edit(member, { Connect: false });
      removeTrustedLocalAndDB(channel.id, member.id);
      await inter.reply(ephemeral(`Пользователь заблокирован: ${member}`));
      break;
    case "unblock_select":
      await channel.permissionOverwrites.delete(member);
      // не добавляем в trusted автоматически
      await inter.reply(ephemeral(`Пользователь разблокирован: ${member}`));
      break;
    case "trusted_add_select": {
      addTrustedLocalAndDB(channel.id, id);
      await inter.reply(ephemeral("Доверенный пользователь добавлен"));
      break;
    }
    case "trusted_remove_select":
      removeTrustedLocalAndDB(channel.id, id);
      await inter.reply(ephemeral("Доверенный пользователь удалён"));
      break;
    case "transfer_select": {
      channelOwners.set(channel.id, id);
      // в БД — смена владельца
      import("../db").then(({ updateOwner }) => updateOwner(channel.id, id));
      addTrustedLocalAndDB(channel.id, id);
      await inter.reply(ephemeral("Лидерство передано"));
      break;
    }
  }
}

export async function handleInteraction(interaction: Interaction) {
  // Точка входа: определяем тип взаимодействия и передаём в нужный обработчик.
  if (interaction.isChatInputCommand())
    switch (interaction.commandName) {
      case "setup":
        return handleSetup(interaction);
      case "interface":
        return handleInterface(interaction);
    }
  if (interaction.isButton()) return handleButton(interaction);
  if (interaction.isStringSelectMenu()) return handleRegionSelect(interaction);
  if (interaction.isModalSubmit()) return handleModal(interaction);
  if (interaction.isUserSelectMenu()) return handleUserSelect(interaction);
}

