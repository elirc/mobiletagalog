# Answers and review criteria

Answers to [05-PRACTICE.md](05-PRACTICE.md). Every break-it outcome and every "new test kills the mutation" claim below was executed on 2026-10-06 against scratch copies of `sync.ts` and `sync.test.ts`, using a small `node:test` shim of the Vitest API (Vitest itself is not installed in the clean clone). Running them under real Vitest after `npm install` should give the same pass/fail split; that was not done.

## Solutions

1. The new baseline is stored and `B` remains local; `f.commits` is `[["a"]]`. `onCommit` receives a fresh read of the outbox (`sync.ts:103`), i.e. `[B]`. Publishing the pre-request array would show `A` again or hide `B`, out of step with storage.
2. Only **test 4** ("does not refresh a stale 401 after the account changes") fails, on `expect(f.deps.refresh).not.toHaveBeenCalled()`. Line 93 still stops the commit, but `refresh` has already been called.
3. Only **test 3** ("discards a response after logout or account replacement") fails: with no final guard, the stale success commits for the old account.
4. All six existing tests still **pass** with the mutation. The new test (in-flight `C`, acknowledgements `["a", "c"]`, expect commits `[["a"]]` and outbox `["c"]`) passes on the real code and **fails** with the mutation.
5. All six still **pass**: `onCommit` is a bare `vi.fn()`. The strengthened assertion on the last `onCommit` call's remainder (`["b"]`) passes on the real code and **fails** with the mutation.
6. All six still **pass** — the user-id half of line 99 covers the different-user test. The new same-user test (`setSession(null)` then `setSession(tokens("one"))` before releasing) passes on the real code and **fails** with the mutation. This is the case the generation counter exists for.
7. On the real code the second attempt runs (`push` called twice), because line 75 stores `operation.catch(() => undefined)` as the tail. With `this.tail = operation`, the second `sync()` chains onto a rejected promise, `runOnce` never runs, and the new test **fails** (`push` called once). One failed sync would silently disable syncing until restart.
8. Within the active session the profile is merged with the coordinator's current tokens, so `accessToken: "refreshed"` survives (test 5). After `setSession(null)`, `this.tokens` is `null`, so `this.tokens?.user.id !== snapshot.tokens.user.id` already returns `null`; the generation half of line 62 is never what decides that test.
9. `null` → `"guest"`: no wipe, guest outbox is kept and synced under the new account. `"a"` → `"b"` → `"account-switch"`: `wipeAll()` plus cleared baseline and outbox (`progress.tsx:96-100`). A provider test would mock `./storage` and `./api` and render `ProgressProvider`; none exists.

## Verified review findings

**F1 — server-rejected events are silently dropped.** `api.sync` returns `{ accepted, rejected: string[], progress }` (`api.ts:54`), but the production `push` adapter (`progress.tsx:47-54`) acknowledges every sent id and discards `rejected`. Rejected events are deleted from the outbox and never surfaced or logged. The inline comment ("rejected poison rows are reported") describes the server, not anything the app does with the report. Deleting poison rows is a reasonable policy, but it should be a visible decision.

**F2 — the intersection is dead code in production.** Because of F1's adapter, `sync.ts:100-101` can never filter anything today. Keep it (it protects against a future adapter), but pair it with the exercise-4 test so it cannot silently regress.

**F3 — documented guarantees without tests.** The eight mutations listed in [04](04-TESTING-AND-DEBUGGING.md) (intersection, either half of line 99, lines 80 and 93, the fresh re-read at 103, the tail at 75, the generation check at 62) all survive the existing suite. Exercises 4-7 close four of them.

**F4 — sync failures are swallowed.** `syncNow` and `adoptAuth` both end in `.catch(() => {})` (`progress.tsx:87`, `:103`), and the timezone effect does the same (`:140`). Nothing records why a sync failed; the only signal is `pendingCount` not decreasing.

**F5 — leftover API.** `outboxClear` (`storage.ts:73-77`) has no callers since `commitSyncedProgress` replaced it. Removing it prevents someone from re-introducing a non-atomic baseline-then-clear path.

## Review criteria

Approve sync changes only if: session invalidation (`setSession`) happens before account data is cleared; baseline write and acknowledgement deletion stay in one transaction; acknowledgements are limited to the sent batch; publication re-reads storage; and each of those has a test that fails when the line is removed. Treat reports carefully: a mocked SQLite contract test is not native device durability, and a fake `push` does not prove the production server's acceptance semantics.

## Source excerpt

From [src/lib/sync.test.ts](../src/lib/sync.test.ts), lines 150-174.

```ts
  it("rejects a delayed profile response after logout and preserves refreshed credentials", () => {
    const coordinator = new ProgressSyncCoordinator(
      fixture([], async () => ({ progress: progress(0), acknowledgedIds: [] })).deps,
      tokens("one"),
    );
    const stale = coordinator.currentSession()!;
    coordinator.setSession(null);
    expect(
      coordinator.applyUserUpdate(stale, { ...stale.tokens.user, tz: "Asia/Manila" }),
    ).toBeNull();

    coordinator.setSession(tokens("one"));
    const active = coordinator.currentSession()!;
    coordinator.updateSessionTokens({ ...tokens("one"), accessToken: "refreshed" });
    expect(
      coordinator.applyUserUpdate(active, { ...active.tokens.user, tz: "Asia/Manila" }),
    ).toMatchObject({ accessToken: "refreshed", user: { tz: "Asia/Manila" } });
  });

  it("distinguishes guest adoption from a true account switch", () => {
    expect(authAdoptionMode(null, "account-b")).toBe("guest");
    expect(authAdoptionMode("account-b", "account-b")).toBe("same-account");
    expect(authAdoptionMode("account-a", "account-b")).toBe("account-switch");
  });
});
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)
