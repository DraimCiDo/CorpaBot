import Database from "better-sqlite3";

export type ChannelRow = {
  channel_id: string;
  owner_id: string;
  number: number | null;
  name: string | null;
  is_private: number; // 0|1
  rtc_region: string | null;
  user_limit: number | null;
  parent_id: string | null;
  created_at: string;
};

let db: Database.Database;

export function initDB(dbPath = "./data/voicebot.sqlite") {
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      channel_id   TEXT PRIMARY KEY,
      owner_id     TEXT NOT NULL,
      number       INTEGER,
      name         TEXT,
      is_private   INTEGER NOT NULL DEFAULT 0,
      rtc_region   TEXT,
      user_limit   INTEGER,
      parent_id    TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trusted (
      channel_id TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      PRIMARY KEY (channel_id, user_id),
      FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE
    );

    -- Свободные номера для повторного использования
    CREATE TABLE IF NOT EXISTS free_numbers (
      number INTEGER PRIMARY KEY
    );

    -- Простой KV для счетчиков и настроек
    CREATE TABLE IF NOT EXISTS kv (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function kvGet(key: string): string | null {
  const row = db.prepare(`SELECT value FROM kv WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
function kvSet(key: string, value: string) {
  db.prepare(`INSERT INTO kv(key, value) VALUES(?, ?)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, value);
}

export function getChannelCounter(): number {
  const v = kvGet("channelCounter");
  return v ? Number(v) : 0;
}
export function setChannelCounter(n: number) {
  kvSet("channelCounter", String(n));
}

export function insertChannel(row: Omit<ChannelRow, "created_at">) {
  db.prepare(`
    INSERT OR REPLACE INTO channels (channel_id, owner_id, number, name, is_private, rtc_region, user_limit, parent_id)
    VALUES (@channel_id, @owner_id, @number, @name, @is_private, @rtc_region, @user_limit, @parent_id)
  `).run(row);
}

export function deleteChannel(channel_id: string) {
  db.prepare(`DELETE FROM channels WHERE channel_id = ?`).run(channel_id);
  db.prepare(`DELETE FROM trusted WHERE channel_id = ?`).run(channel_id);
}

export function updateOwner(channel_id: string, owner_id: string) {
  db.prepare(`UPDATE channels SET owner_id = ? WHERE channel_id = ?`).run(owner_id, channel_id);
}

export function updateName(channel_id: string, name: string) {
  db.prepare(`UPDATE channels SET name = ? WHERE channel_id = ?`).run(name, channel_id);
}

export function updatePrivate(channel_id: string, is_private: boolean) {
  db.prepare(`UPDATE channels SET is_private = ? WHERE channel_id = ?`).run(is_private ? 1 : 0, channel_id);
}

export function updateRtcRegion(channel_id: string, rtc_region: string | null) {
  db.prepare(`UPDATE channels SET rtc_region = ? WHERE channel_id = ?`).run(rtc_region, channel_id);
}

export function updateUserLimit(channel_id: string, user_limit: number | null) {
  db.prepare(`UPDATE channels SET user_limit = ? WHERE channel_id = ?`).run(user_limit, channel_id);
}

export function updateParent(channel_id: string, parent_id: string | null) {
  db.prepare(`UPDATE channels SET parent_id = ? WHERE channel_id = ?`).run(parent_id, channel_id);
}

export function addTrusted(channel_id: string, user_id: string) {
  db.prepare(`INSERT OR IGNORE INTO trusted(channel_id, user_id) VALUES (?, ?)`).run(channel_id, user_id);
}
export function removeTrusted(channel_id: string, user_id: string) {
  db.prepare(`DELETE FROM trusted WHERE channel_id = ? AND user_id = ?`).run(channel_id, user_id);
}
export function listTrusted(channel_id: string): string[] {
  const rows = db.prepare(`SELECT user_id FROM trusted WHERE channel_id = ?`).all(channel_id) as { user_id: string }[];
  return rows.map(r => r.user_id);
}

export function listChannels(): ChannelRow[] {
  return db.prepare(`SELECT * FROM channels`).all() as ChannelRow[];
}

export function popFreeNumber(): number | null {
  const row = db.prepare(`SELECT number FROM free_numbers ORDER BY number ASC LIMIT 1`).get() as { number: number } | undefined;
  if (!row) return null;
  db.prepare(`DELETE FROM free_numbers WHERE number = ?`).run(row.number);
  return row.number;
}
export function pushFreeNumber(num: number) {
  db.prepare(`INSERT OR IGNORE INTO free_numbers(number) VALUES (?)`).run(num);
}
export function listFreeNumbers(): number[] {
  const rows = db.prepare(`SELECT number FROM free_numbers ORDER BY number ASC`).all() as { number: number }[];
  return rows.map(r => r.number);
}