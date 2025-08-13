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
  channelPrivates,
  channelRtcRegion,
  channelUserLimit,
} from "./state";
import {
  CREATE_CHANNEL_NAME,
  TEMP_CHANNEL_PREFIX,
  LOCK_OPEN,
  LOCK_CLOSED,
} from "./constants";

import {
  insertChannel,
  deleteChannel as dbDeleteChannel,
  updateOwner,
  updateName,
  updatePrivate,
  updateRtcRegion,
  updateUserLimit,
  addTrusted as dbAddTrusted,
  removeTrusted as dbRemoveTrusted,
  listTrusted,
  getChannelCounter,
  setChannelCounter,
  popFreeNumber,
  pushFreeNumber,
} from "./db";

// Счётчик номеров: теперь берём/кладём в БД
let channelCounter = 0;
export function setCounterFromDB() {
  channelCounter = getChannelCounter();
}
function allocateNumber(): number {
  const freed = popFreeNumber();
  if (freed !== null) {
    availableNumbers.delete(freed);
    return freed;
  }
  channelCounter = Math.max(channelCounter, getChannelCounter());
  channelCounter += 1;
  setChannelCounter(channelCounter);
  return channelCounter;
}
function releaseNumber(n: number) {
  pushFreeNumber(n);
  availableNumbers.add(n);
}

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

export function isManager(channelId: string, userId: string): boolean {
  return (
    channelOwners.get(channelId) === userId ||
    trustedUsers.get(channelId)?.has(userId) === true
  );
}

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

// Создание нового временного канала (вызов из voiceStateUpdate)
async function createTempChannel(newState: any): Promise<VoiceChannel> {
  const category = newState.channel.parent as CategoryChannel | null;
  const number = allocateNumber();

  const newChannel = (await newState.guild.channels.create({
    name: `[${LOCK_OPEN}] ${TEMP_CHANNEL_PREFIX}[#${number}]`,
    type: ChannelType.GuildVoice,
    parent: category ?? undefined,
  })) as VoiceChannel;

  // Память
  createdChannels.add(newChannel.id);
  channelOwners.set(newChannel.id, newState.id);
  const set = new Set<string>([newState.id]);
  trustedUsers.set(newChannel.id, set);
  channelNumbers.set(newChannel.id, number);
  channelNames.set(newChannel.id, TEMP_CHANNEL_PREFIX);
  channelPrivates.set(newChannel.id, false);
  channelRtcRegion.set(newChannel.id, null);
  channelUserLimit.set(newChannel.id, null);

  // БД
  insertChannel({
    channel_id: newChannel.id,
    owner_id: newState.id,
    number,
    name: TEMP_CHANNEL_PREFIX,
    is_private: 0,
    rtc_region: null,
    user_limit: null,
    parent_id: category?.id ?? null,
  });
  dbAddTrusted(newChannel.id, newState.id);

  return newChannel;
}

async function purgeOrReassignOnLeave(oldState: any) {
  const vc: VoiceChannel = oldState.channel;
  if (vc.members.size === 0) {
    // удаляем канал
    createdChannels.delete(vc.id);
    const number = channelNumbers.get(vc.id);
    if (number !== undefined) releaseNumber(number);

    channelOwners.delete(vc.id);
    trustedUsers.delete(vc.id);
    channelNumbers.delete(vc.id);
    channelNames.delete(vc.id);
    channelPrivates.delete(vc.id);
    channelRtcRegion.delete(vc.id);
    channelUserLimit.delete(vc.id);

    // БД
    dbDeleteChannel(vc.id);

    try {
      await vc.delete();
    } catch { /* already removed */ }
  } else {
    // если вышел владелец — назначаем первого
    const ownerId = channelOwners.get(vc.id);
    if (ownerId === oldState.id) {
      const [first] = vc.members.values();
      if (first) {
        channelOwners.set(vc.id, first.id);
        updateOwner(vc.id, first.id);
      }
    }
  }
}

export async function handleVoiceStateUpdate(oldState: any, newState: any) {
  // Зашел в "Создать канал"
  if (newState.channel && newState.channel.name === CREATE_CHANNEL_NAME) {
    const ch = await createTempChannel(newState);
    await newState.setChannel(ch);
  }

  // Покидает наш временный канал
  if (oldState.channel && createdChannels.has(oldState.channel.id)) {
    await purgeOrReassignOnLeave(oldState);
  }
}

// ==== вспомогательные методы для interactions.ts =====

export async function persistRename(channel: VoiceChannel, newBaseName: string) {
  channelNames.set(channel.id, newBaseName);
  updateName(channel.id, newBaseName);

  const everyone = channel.guild.roles.everyone;
  const overwrite = channel.permissionOverwrites.resolve(everyone.id);
  const isPrivate = !!overwrite?.deny.has("Connect" as any);
  channelPrivates.set(channel.id, isPrivate);

  await channel.setName(formatChannelName(channel.id, isPrivate));
}

export async function persistPrivacy(channel: VoiceChannel, isPrivate: boolean) {
  channelPrivates.set(channel.id, isPrivate);
  updatePrivate(channel.id, isPrivate);
  await channel.setName(formatChannelName(channel.id, isPrivate));
}

export function persistRtcRegion(channelId: string, value: string | null) {
  channelRtcRegion.set(channelId, value);
  updateRtcRegion(channelId, value);
}

export function persistUserLimit(channelId: string, limit: number | null) {
  channelUserLimit.set(channelId, limit);
  updateUserLimit(channelId, limit);
}

export function addTrustedLocalAndDB(channelId: string, userId: string) {
  const set = trustedUsers.get(channelId) ?? new Set<string>();
  set.add(userId);
  trustedUsers.set(channelId, set);
  dbAddTrusted(channelId, userId);
}
export function removeTrustedLocalAndDB(channelId: string, userId: string) {
  trustedUsers.get(channelId)?.delete(userId);
  dbRemoveTrusted(channelId, userId);
}