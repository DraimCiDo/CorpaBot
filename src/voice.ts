// Логика работы с голосовыми каналами: создание, удаление,
// переименование и проверка прав пользователей.
import {
  CategoryChannel,
  ChannelType,
  VoiceChannel,
  Interaction,
} from "discord.js";
import {
  createdChannels,
  channelOwners,
  trustedUsers,
  channelNumbers,
  channelNames,
  availableNumbers,
} from "./state";
import {
  CREATE_CHANNEL_NAME,
  TEMP_CHANNEL_PREFIX,
  LOCK_OPEN,
  LOCK_CLOSED,
} from "./constants";

// Счётчик, чтобы выдавать новым каналам уникальные номера.
let channelCounter = 0;

// Формирует отображаемое имя канала с учётом приватности и номера.
export function formatChannelName(
  channelId: string,
  isPrivate: boolean
): string {
  const base = channelNames.get(channelId) ?? TEMP_CHANNEL_PREFIX;
  const number = channelNumbers.get(channelId);
  const lock = isPrivate ? LOCK_CLOSED : LOCK_OPEN;
  const suffix = number !== undefined ? `[#${number}]` : "";
  return `[${lock}] ${base}${suffix}`;
}

// Проверяет, имеет ли пользователь право управлять каналом
// (является владельцем или доверенным).
export function isManager(channelId: string, userId: string): boolean {
  return (
    channelOwners.get(channelId) === userId ||
    trustedUsers.get(channelId)?.has(userId) === true
  );
}

// Возвращает временный канал пользователя, если он в нём находится.
export function getUserTempChannel(
  interaction: Interaction
): VoiceChannel | null {
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const channel = member?.voice.channel as VoiceChannel | null | undefined;
  if (channel && createdChannels.has(channel.id)) {
    return channel;
  }
  return null;
}

// Основной обработчик изменений голосовых состояний пользователей.
// Создаёт новые каналы при входе в "Создать канал" и удаляет пустые.
export async function handleVoiceStateUpdate(oldState: any, newState: any) {
  // Пользователь зашёл в канал для создания временной комнаты.
  if (newState.channel && newState.channel.name === CREATE_CHANNEL_NAME) {
    const category = newState.channel.parent as CategoryChannel | null;
    // Берём свободный номер или увеличиваем счётчик.
    const number =
      availableNumbers.size > 0
        ? Math.min(...availableNumbers)
        : ++channelCounter;
    if (availableNumbers.size > 0) {
      availableNumbers.delete(number);
    }
    // Создаём новый голосовой канал в той же категории.
    const newChannel = (await newState.guild.channels.create({
      name: `[${LOCK_OPEN}] ${TEMP_CHANNEL_PREFIX}[#${number}]`,
      type: ChannelType.GuildVoice,
      parent: category ?? undefined,
    })) as VoiceChannel;
    createdChannels.add(newChannel.id);
    channelOwners.set(newChannel.id, newState.id);
    trustedUsers.set(newChannel.id, new Set([newState.id]));
    channelNumbers.set(newChannel.id, number);
    channelNames.set(newChannel.id, TEMP_CHANNEL_PREFIX);
    await newState.setChannel(newChannel); // перенаправляем пользователя
  }

  // Обработка выхода пользователя из временного канала.
  if (oldState.channel && createdChannels.has(oldState.channel.id)) {
    if (oldState.channel.members.size === 0) {
      // Если канал опустел — удаляем и освобождаем ресурсы.
      createdChannels.delete(oldState.channel.id);
      channelOwners.delete(oldState.channel.id);
      trustedUsers.delete(oldState.channel.id);
      const number = channelNumbers.get(oldState.channel.id);
      if (number !== undefined) {
        availableNumbers.add(number);
      }
      channelNumbers.delete(oldState.channel.id);
      channelNames.delete(oldState.channel.id);
      try {
        await oldState.channel.delete();
      } catch {
        // канал мог быть удалён вручную
      }
    } else {
      // Если владелец вышел, назначаем нового владельца (первого в списке).
      const ownerId = channelOwners.get(oldState.channel.id);
      if (ownerId === oldState.id) {
        const [first] = oldState.channel.members.values();
        if (first) {
          channelOwners.set(oldState.channel.id, first.id);
        }
      }
    }
  }
}
