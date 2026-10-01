# Mobiletagalog: synchronize without losing local progress

The mobile app combines a server progress baseline with a local outbox. A learner may complete another activity while an earlier batch is being synchronized. A safe response handler must acknowledge only the sent events, preserve newly added events, and publish the resulting baseline and remainder together. It must also reject a response belonging to a session that has already ended.

This course follows those requirements through ProgressSyncCoordinator, device persistence, and ProgressProvider. The coordinator serializes sync requests and associates each with an authentication generation. Device storage commits the returned baseline and acknowledged identifiers in one synchronous transaction. The provider rereads remaining events after that commit, so a closure captured before the network request cannot discard later work.

Begin with the map and concepts chapters, then trace the deferred-response examples. The tests use controlled promises for network interleavings and a mock SQLite adapter for transaction-contract assertions. They do not run an Expo device or certify native SQLite durability. The verification chapter retains that distinction alongside actual command results.

The change also handles authentication transitions. Guest events survive initial sign-in, but a direct switch between different signed-in users clears the previous account's progress. Logout invalidates in-flight responses. A delayed timezone profile update cannot restore old credentials or overwrite a refreshed access token. Each of these behaviors is part of keeping progress attached to the correct session.

## Source excerpt

From [src/lib/sync.ts](../src/lib/sync.ts).

```ts
/** Serial sync bound to the auth generation that issued each request. */
export class ProgressSyncCoordinator {
  private generation = 0;
  private tokens: AuthTokens | null;
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly dependencies: ProgressSyncDependencies,
    initialTokens: AuthTokens | null,
  ) {
    this.tokens = initialTokens;
  }

  setSession(tokens: AuthTokens | null): void {
    this.generation += 1;
    this.tokens = tokens;
  }

  currentSession(): SyncSessionSnapshot | null {
    return this.tokens ? { generation: this.generation, tokens: this.tokens } : null;
  }

  updateSessionTokens(tokens: AuthTokens): void {
    if (this.tokens?.user.id === tokens.user.id) this.tokens = tokens;
  }

  applyUserUpdate(
    snapshot: SyncSessionSnapshot,
    user: AuthTokens["user"],
  ): AuthTokens | null {
    if (
      snapshot.generation !== this.generation ||
      this.tokens?.user.id !== snapshot.tokens.user.id
    ) {
      return null;
    }
    // Preserve credentials that may have refreshed while updateMe was in flight.
    this.tokens = { ...this.tokens, user };
    return this.tokens;
  }

  sync(): Promise<void> {
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)
