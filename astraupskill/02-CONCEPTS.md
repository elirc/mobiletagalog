# A response belongs to a generation

User identity alone is not a sufficient stale-response guard. A user can log out and later sign into the same account while an old request is still pending. The identifier matches again, but the old request belongs to a different session. The coordinator increments a generation on every setSession call and captures that generation when sync is requested.

Queued operations check the captured generation before reading the outbox or making a request. In-flight operations check again before committing a result. The refresh branch checks before requesting new credentials and after refresh completes. These checks prevent a late unauthorized response from initiating a refresh for an abandoned account and prevent returned credentials from restoring a logged-out session.

The acknowledgement boundary is narrower than clearing the outbox. Only identifiers present in the sent batch may be removed. A server response containing an unrelated identifier is intersected with that batch. Events added while the request was pending remain in storage and are included in the next derived view.

Profile updates have a related but distinct rule. A returned user profile may be current while its captured access token is outdated because refresh occurred in the meantime. applyUserUpdate checks the generation and account, then combines the returned user with the coordinator's current tokens. This preserves newer credentials instead of rebuilding authentication from an old closure. The tests exercise both logout rejection and refreshed-token preservation.

## Source excerpt

From [src/lib/sync.ts](../src/lib/sync.ts).

```ts
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
    const requestedGeneration = this.generation;
    const operation = this.tail.then(() => this.runOnce(requestedGeneration));
    this.tail = operation.catch(() => undefined);
    return operation;
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)
