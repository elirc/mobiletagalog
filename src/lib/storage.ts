import * as SQLite from "expo-sqlite";
import type { ProgressEvent } from "@/core";

/**
 * Device persistence (OFF-01/OFF-02):
 *  - kv: auth tokens, server progress baseline, cached content bundle, theme
 *  - outbox: progress events awaiting sync, flushed by the sync worker
 */
const db = SQLite.openDatabaseSync("aral.db");

db.execSync(`
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

export function kvGet<T>(key: string): T | null {
  const row = db.getFirstSync<{ value: string }>("SELECT value FROM kv WHERE key = ?", key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function kvSet(key: string, value: unknown): void {
  if (value === null || value === undefined) {
    db.runSync("DELETE FROM kv WHERE key = ?", key);
  } else {
    db.runSync(
      "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      JSON.stringify(value),
    );
  }
}

/** Atomically adopt server progress and acknowledge only included events. */
export function commitSyncedProgress(baseline: unknown, acknowledgedIds: string[]): void {
  db.withTransactionSync(() => {
    db.runSync(
      "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      "baseline",
      JSON.stringify(baseline),
    );
    for (const id of acknowledgedIds) db.runSync("DELETE FROM outbox WHERE id = ?", id);
  });
}

export function outboxAdd(events: ProgressEvent[]): void {
  db.withTransactionSync(() => {
    for (const ev of events) {
      db.runSync(
        "INSERT OR IGNORE INTO outbox (id, payload, created_at) VALUES (?, ?, ?)",
        ev.id,
        JSON.stringify(ev),
        Date.now(),
      );
    }
  });
}

export function outboxAll(): ProgressEvent[] {
  return db
    .getAllSync<{ payload: string }>("SELECT payload FROM outbox ORDER BY created_at")
    .map((r) => JSON.parse(r.payload) as ProgressEvent);
}

export function outboxClear(ids: string[]): void {
  db.withTransactionSync(() => {
    for (const id of ids) db.runSync("DELETE FROM outbox WHERE id = ?", id);
  });
}

/**
 * Logout wipe. Deliberately keeps the `kv` rows that aren't account data —
 * the theme choice is a device preference and shouldn't reset on logout.
 */
export function wipeAll(): void {
  db.execSync("DELETE FROM outbox;");
  db.runSync("DELETE FROM kv WHERE key IN ('auth', 'baseline')");
}
