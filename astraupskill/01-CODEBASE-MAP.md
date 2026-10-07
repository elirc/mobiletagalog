# Map baseline, outbox, and authentication state

Mobiletagalog is an Expo 53 / React Native 0.79 Tagalog course app (expo-router screens in `app/`, logic in `src/`). Progress is event-sourced: visible progress = last server baseline + unsent local events. Three files carry the sync story.

| File | Lines | Role |
|---|---|---|
| [src/lib/storage.ts](../src/lib/storage.ts) | 43-52 `commitSyncedProgress`; 54-65 `outboxAdd`; 67-71 `outboxAll`; 83-86 `wipeAll` | Device SQLite (`expo-sqlite`). The commit writes the `baseline` kv row and deletes acknowledged outbox ids inside one `withTransactionSync`. `outboxAdd` uses `INSERT OR IGNORE`, so the first write of an event id wins. |
| [src/lib/sync.ts](../src/lib/sync.ts) | 14-20 `authAdoptionMode`; 22-29 dependency interface; 32-105 `ProgressSyncCoordinator` | Framework-independent. Dependencies are injected (read outbox, push, refresh, commit, publish tokens, publish progress), so delayed responses are testable without React. |
| [src/lib/progress.tsx](../src/lib/progress.tsx) | 44-69 wiring; 81-84 `addEvents`; 90-104 `adoptAuth`; 106-112 `logout`; 114-118 2-second sync timer; 127-141 timezone effect | Connects the coordinator to React, the real API, and storage. |
| [src/core/events.ts](../src/core/events.ts) | 71 `reduceEvents` | Pure reducer: baseline + outbox → `UserProgress`. It never decides whether a response is current. |

Who calls in: `LessonPlayer.tsx:96` and `app/stats.tsx:229` call `addEvents`; `AuthScreen.tsx:31` calls `adoptAuth`; `app/index.tsx:89` wires the logout button.

Two facts worth knowing before you read the chapters:

- The production `push` adapter (`progress.tsx:47-54`) acknowledges **every** sent event (`events.map((event) => event.id)`) and ignores the `rejected: string[]` field that `api.sync` returns (`api.ts:54`). The coordinator's sent-batch intersection (`sync.ts:100-101`) is therefore a defensive guard for a future adapter; it never filters anything today.
- `outboxClear` (`storage.ts:73-77`) is no longer called anywhere; `commitSyncedProgress` replaced it.

When diagnosing a mismatch, inspect the sent batch, acknowledged ids, active generation, and persisted remainder before changing the reducer. Each answers a different question: what was sent, what was accepted, who owns the response, and what remains local.

## Source excerpt

From [src/lib/progress.tsx](../src/lib/progress.tsx), lines 90-122.

```tsx
  const adoptAuth = useCallback(async (tokens: AuthTokens) => {
    const mode = authAdoptionMode(
      syncCoordinator.current!.currentSession()?.tokens.user.id ?? null,
      tokens.user.id,
    );
    syncCoordinator.current!.setSession(tokens);
    if (mode === "account-switch") {
      wipeAll();
      setBaseline(null);
      setOutbox([]);
    }
    kvSet("auth", tokens);
    setAuth(tokens);
    await syncCoordinator.current!.sync().catch(() => {});
  }, []);

  const logout = useCallback(() => {
    syncCoordinator.current!.setSession(null);
    wipeAll();
    setAuth(null);
    setBaseline(null);
    setOutbox([]);
  }, []);

  useEffect(() => {
    if (!auth || outbox.length === 0) return;
    const timer = setTimeout(() => void syncNow(), 2000);
    return () => clearTimeout(timer);
  }, [auth, outbox, syncNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)
