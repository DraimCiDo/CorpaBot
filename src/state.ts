// Хранилище состояния для временных голосовых каналов.

// ID всех созданных ботом каналов.
export const createdChannels = new Set<string>();
// Соответствие ID канала и его владельца.
export const channelOwners = new Map<string, string>();
// Пользователи, имеющие права управлять каналом (помимо владельца).
export const trustedUsers = new Map<string, Set<string>>();
// Порядковые номера каналов (используются в названии `[#+]`).
export const channelNumbers = new Map<string, number>();
// Индивидуальные имена каналов без служебных префиксов.
export const channelNames = new Map<string, string>();
// Свободные номера, которые можно повторно использовать для новых каналов.
export const availableNumbers = new Set<number>();
