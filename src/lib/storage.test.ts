import { beforeEach, describe, expect, it, vi } from "vitest";

const sqlite = vi.hoisted(() => {
  const kv = new Map<string, string>();
  const outbox = new Map<string, string>();
  let failDeleteId: string | null = null;
  const db = {
    execSync: vi.fn(),
    getFirstSync: vi.fn(),
    getAllSync: vi.fn(),
    runSync: vi.fn((sql: string, ...raw: unknown[]) => {
      const args = Array.isArray(raw[0]) ? (raw[0] as unknown[]) : raw;
      if (sql.startsWith("INSERT INTO kv")) kv.set(String(args[0]), String(args[1]));
      if (sql.startsWith("DELETE FROM outbox")) {
        const id = String(args[0]);
        if (id === failDeleteId) throw new Error("simulated delete failure");
        outbox.delete(id);
      }
    }),
    withTransactionSync: vi.fn((operation: () => void) => {
      const kvBefore = new Map(kv);
      const outboxBefore = new Map(outbox);
      try {
        operation();
      } catch (error) {
        kv.clear();
        outbox.clear();
        for (const entry of kvBefore) kv.set(...entry);
        for (const entry of outboxBefore) outbox.set(...entry);
        throw error;
      }
    }),
  };
  return {
    kv,
    outbox,
    db,
    failOnDelete: (id: string | null) => (failDeleteId = id),
  };
});

vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => sqlite.db }));

import { commitSyncedProgress } from "./storage";

describe("SQLite sync commit adapter contract (mocked database)", () => {
  beforeEach(() => {
    sqlite.kv.clear();
    sqlite.outbox.clear();
    sqlite.failOnDelete(null);
    sqlite.db.withTransactionSync.mockClear();
  });

  it("stores the baseline and removes only acknowledged rows in one transaction", () => {
    sqlite.outbox.set("sent", "event-a");
    sqlite.outbox.set("in-flight", "event-b");

    commitSyncedProgress({ xpTotal: 10 }, ["sent"]);

    expect(JSON.parse(sqlite.kv.get("baseline")!)).toEqual({ xpTotal: 10 });
    expect([...sqlite.outbox.keys()]).toEqual(["in-flight"]);
    expect(sqlite.db.withTransactionSync).toHaveBeenCalledTimes(1);
  });

  it("rolls back both baseline and acknowledgements when the adapter throws", () => {
    sqlite.kv.set("baseline", JSON.stringify({ xpTotal: 5 }));
    sqlite.outbox.set("a", "event-a");
    sqlite.outbox.set("b", "event-b");
    sqlite.failOnDelete("b");

    expect(() => commitSyncedProgress({ xpTotal: 20 }, ["a", "b"])).toThrow(
      "simulated delete failure",
    );
    expect(JSON.parse(sqlite.kv.get("baseline")!)).toEqual({ xpTotal: 5 });
    expect([...sqlite.outbox.keys()]).toEqual(["a", "b"]);
  });
});
