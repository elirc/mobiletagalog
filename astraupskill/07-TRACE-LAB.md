# Trace A, B, and a logout

Draw columns for the UI, coordinator, server, and device database. Begin with event A in the outbox and a sync request at generation zero. The coordinator reads A and waits for the server. While it waits, the UI records B and rereads the persisted outbox. The screen can now derive progress from A and B using the existing baseline.

Release the server response for A. The coordinator confirms generation zero, intersects acknowledgements with the sent batch, and commits the new baseline with deletion of A. It then rereads storage and publishes B as the remainder. A second queued sync starts only after that sequence, so its batch reflects current storage rather than the state at the time the second call was originally queued.

Restart the trace but insert logout before the response. setSession advances the generation and clears active credentials; account storage is wiped. The old response reaches the final guard and exits without commit. No baseline callback may restore A's progress. Repeat with a stale 401 to observe the earlier guard before refresh.

Finally, add a timezone request to the active-session trace and refresh credentials while it waits. The profile response may update the current user, but it must retain the newly refreshed access token. These timelines let you identify exactly which guard protects each callback and what state a failed assertion would implicate.

## Source excerpt

From [src/lib/progress.tsx](../src/lib/progress.tsx).

```tsx
  useEffect(() => {
    if (!auth) return;
    const tz = deviceTz();
    const session = syncCoordinator.current!.currentSession();
    if (!session || session.tokens.user.tz === tz) return;
    api
      .updateMe(session.tokens.accessToken, { tz })
      .then(({ user }) => {
        const next = syncCoordinator.current!.applyUserUpdate(session, user);
        if (!next) return;
        kvSet("auth", next);
        setAuth(next);
      })
      .catch(() => {});
  }, [auth]);

  const value = useMemo(
    () => ({
      progress,
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)
