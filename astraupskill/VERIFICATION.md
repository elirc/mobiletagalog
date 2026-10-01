# Verification and device boundaries

The accepted command records below provide exact arguments, terminal results, and logs. They distinguish dependency setup from tests and type checking. A successful installation does not establish synchronization correctness; the deferred-response and storage-contract assertions supply that evidence at their stated boundaries.

The coordinator tests execute the actual framework-independent class with injected storage and provider functions. They control interleavings through promises rather than contacting the production service. The storage fixture models the Expo SQLite API used by commitSyncedProgress. It checks that baseline adoption and acknowledgement belong to one transaction, but it cannot verify the native implementation on Android or iOS.

The provider integration was reviewed for generation invalidation, account-switch clearing, fresh outbox reads, and guarded timezone updates. A device UI run remains a distinct verification activity and is not inferred from those source checks. Guest adoption behavior and direct account switching should be exercised together when such an environment is available.

Read the logs with the changed-source snapshots. Existing project material is preserved, while this course focuses on one progress synchronization contract. Future work may add device restart tests or server acceptance integration, but those claims require their own controlled environments. Do not run test cleanup against the user's original device database. The temporary test fixtures in this delivery use their own state and do not contact external accounts or providers.

## Source excerpt

From [src/lib/storage.ts](../src/lib/storage.ts).

```ts
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
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)

## Recorded command evidence

The accepted test evidence covers **10 distinct passing tests**. The commands below define the verified scope; repeated targeted runs do not increase the count.

| Check | Recorded command | Exit | Evidence |
|---|---|---:|---|
| `astra-mobile-tests-r1` | `["node", "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js", "run", "test", "--", "--minWorkers=1", "--testTimeout=30000"]` | 0 | [record](evidence/astra-mobile-tests-r1.json), [log](evidence/astra-mobile-tests-r1.log) |
| `astra-mobile-typecheck-r1` | `["node", "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js", "run", "typecheck"]` | 0 | [record](evidence/astra-mobile-typecheck-r1.json), [log](evidence/astra-mobile-typecheck-r1.log) |
