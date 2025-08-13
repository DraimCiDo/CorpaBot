import { client, login } from "./client";
import { registerCommands } from "./registerCommands";
import { handleInteraction } from "./handlers/interactions";
import { handleVoiceStateUpdate, setCounterFromDB } from "./voice";
import { initDB, listChannels, listTrusted, setChannelCounter, getChannelCounter } from "./db";
import {
  createdChannels, channelOwners, trustedUsers, channelNumbers, channelNames,
  availableNumbers, channelPrivates, channelRtcRegion, channelUserLimit, clearState
} from "./state";

client.once("ready", async () => {
  // init DB и прогрев памяти из БД
  initDB();
  await registerCommands(client);

  // сверим фактические каналы на сервере и применим сохранённые параметры
  for (const [channelId] of createdChannels) {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (!ch || ch.type !== 2) { // 2 = GuildVoice
      // канала уже нет — удалим запись из БД
      import("./db").then(({ deleteChannel }) => deleteChannel(channelId));
      continue;
    }
    const vc = ch as any; // VoiceChannel
    const isPriv = channelPrivates.get(channelId) ?? false;
    const name = (channelNames.get(channelId) ?? "Канал ");
    const number = channelNumbers.get(channelId);
    const expectedName = `[${isPriv ? "🔒" : "🔓"}] ${name}${number ? `[#${number}]` : ""}`;

    if (vc.name !== expectedName) await vc.setName(expectedName).catch(() => {});
    const limit = channelUserLimit.get(channelId);
    if (typeof limit === "number" && vc.userLimit !== limit) await vc.setUserLimit(limit).catch(() => {});
    const rtc = channelRtcRegion.get(channelId) ?? null;
    await vc.setRTCRegion(rtc).catch(() => {}); // если регион недоступен — просто проигнорируем
  }

  clearState();

  // загрузим счетчик
  setCounterFromDB();

  // прогружаем каналы
  const rows = listChannels();
  for (const r of rows) {
    createdChannels.add(r.channel_id);
    channelOwners.set(r.channel_id, r.owner_id);
    if (r.number != null) channelNumbers.set(r.channel_id, r.number);
    if (r.name) channelNames.set(r.channel_id, r.name);
    channelPrivates.set(r.channel_id, !!r.is_private);
    channelRtcRegion.set(r.channel_id, r.rtc_region);
    channelUserLimit.set(r.channel_id, r.user_limit);

    const t = listTrusted(r.channel_id);
    trustedUsers.set(r.channel_id, new Set(t));
  }

  // свободные номера просто покажем в Set (для справки в памяти)
  // (они и так хранятся в таблице free_numbers и будут выдаваться через popFreeNumber)
  // availableNumbers можно наполнить для отладочной информации:
  // import { listFreeNumbers } from "./db"; availableNumbers = new Set(listFreeNumbers());

  console.log("Bot ready");
});

client.on("interactionCreate", handleInteraction);
client.on("voiceStateUpdate", handleVoiceStateUpdate);

login();