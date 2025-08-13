// Хранилище в памяти + синхронизация с БД

export const createdChannels = new Set<string>();
export const channelOwners   = new Map<string, string>();
export const trustedUsers    = new Map<string, Set<string>>();
export const channelNumbers  = new Map<string, number>();
export const channelNames    = new Map<string, string>();
export const availableNumbers = new Set<number>();
export const channelPrivates = new Map<string, boolean>();
export const channelRtcRegion = new Map<string, string | null>();
export const channelUserLimit = new Map<string, number | null>();

// helpers для начальной загрузки из БД (вызывается в bot.ts при ready)
export function clearState() {
  createdChannels.clear();
  channelOwners.clear();
  trustedUsers.clear();
  channelNumbers.clear();
  channelNames.clear();
  availableNumbers.clear();
  channelPrivates.clear();
  channelRtcRegion.clear();
  channelUserLimit.clear();
}