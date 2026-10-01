# Map baseline, outbox, and authentication state

storage.ts owns the device SQLite connection, key-value records, and outbox rows. commitSyncedProgress writes the server baseline and deletes only acknowledged identifiers inside withTransactionSync. outboxAdd preserves first-write-wins event identity through INSERT OR IGNORE. outboxAll provides the accepted local remainder used for display.

sync.ts contains the framework-independent coordinator. Its dependencies describe the boundaries needed for a sync attempt: read the outbox, push a batch, refresh credentials, commit acknowledgement, and publish tokens or progress. This interface makes delayed network responses testable without mounting the entire mobile app.

progress.tsx connects the coordinator to React and the actual API/storage functions. addEvents persists then rereads the outbox. syncNow delegates to the coordinator. adoptAuth distinguishes guest adoption from a true account switch; logout advances the session generation before clearing account state. The timezone effect captures a session snapshot and applies a returned user profile only if that snapshot still belongs to the active generation.

The core reducer combines the baseline and unsent events into visible progress. It does not decide whether a remote response is current. That decision belongs in the coordinator before storage mutation. When diagnosing a mismatch, inspect the sent batch, acknowledged IDs, active generation, and persisted remainder before changing the reducer. Each boundary answers a different question: what was sent, what was accepted, who owns the response, and what remains local.

## Source excerpt

From [src/lib/progress.tsx](../src/lib/progress.tsx).

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
