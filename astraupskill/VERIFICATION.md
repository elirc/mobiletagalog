# Verification and device boundaries

## Recorded runs

| Date | Check | Command (as run, from repo root) | Result | Record |
|---|---|---|---|---|
| 2026-09-19 | tests | `npm run test -- --minWorkers=1 --testTimeout=30000` | exit 0; 10 tests across 3 files | [evidence/astra-mobile-tests-r1.json](evidence/astra-mobile-tests-r1.json) |
| 2026-09-19 | typecheck | `npm run typecheck` | exit 0 | [evidence/astra-mobile-typecheck-r1.json](evidence/astra-mobile-typecheck-r1.json) |
| 2026-10-06 | coordinator mutations | scratch copies of `sync.ts` + `sync.test.ts`, run with `node --experimental-transform-types --test` and a minimal Vitest-API shim | unmodified: 6/6 pass; mutation outcomes as recorded in [04](04-TESTING-AND-DEBUGGING.md) and [06](06-SOLUTIONS-AND-REVIEW.md) | this file |

The two JSON records name `.log` files (`astra-mobile-tests-r1.log`, `astra-mobile-typecheck-r1.log`) that were never committed to this repo; only the JSON records exist. The records also contain the original staging directory and an absolute path to `npm-cli.js`; the commands above are the same invocations written portably. The "10 tests" figure was re-counted from source on 2026-10-06 (`sync.test.ts` 6, `storage.test.ts` 2, `core/events.test.ts` 2).

The 2026-10-06 runs did **not** use Vitest (no `node_modules` in the clean clone, and installs were out of scope). The shim implemented only what `sync.test.ts` uses (`describe`, `it`, `vi.fn`, `vi.waitFor`, and six matchers). Treat those results as strong evidence about which lines the tests constrain, not as a replacement for `npm test`.

## What the evidence covers

The coordinator tests execute the real framework-independent class with injected storage and provider functions; interleavings are controlled with promises, not a live service. The storage test mocks `expo-sqlite` (`storage.test.ts:42`) and checks that baseline adoption and acknowledgement happen in one transaction and roll back together; it cannot verify the native implementation on Android or iOS.

## What was only read in source

The provider integration (`progress.tsx`): generation invalidation before clearing, account-switch clearing, fresh outbox reads after commit, and the guarded timezone update. No device or UI run is inferred from those reads. Guest adoption and direct account switching should be exercised together on a device when one is available. Do not run test cleanup against a real device database.

## Source excerpt

From [src/lib/storage.ts](../src/lib/storage.ts), lines 42-71.

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
