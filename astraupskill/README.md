# Mobiletagalog: synchronize without losing local progress

Mobiletagalog is an Expo 53 / React Native 0.79 Tagalog course app. Progress is a server baseline plus a local outbox of events in device SQLite. A learner may finish another lesson while an earlier batch is syncing, so a safe response handler must acknowledge only the sent events, keep newly added events, publish baseline and remainder together, and reject a response that belongs to a session that has already ended.

This course follows those requirements through `ProgressSyncCoordinator` ([src/lib/sync.ts](../src/lib/sync.ts)), device persistence ([src/lib/storage.ts](../src/lib/storage.ts)), and `ProgressProvider` ([src/lib/progress.tsx](../src/lib/progress.tsx)). It also covers authentication transitions: guest events survive first sign-in, a switch between two signed-in users clears the previous account's data, logout invalidates in-flight responses, and a late timezone update cannot restore old credentials.

## Reading order

1. [01-CODEBASE-MAP](01-CODEBASE-MAP.md) — the four files, with line ranges, and two facts about the production adapter.
2. [02-CONCEPTS](02-CONCEPTS.md) — generations vs user identity, and which half of the guard the tests actually exercise.
3. [03-WORKED-CHANGE](03-WORKED-CHANGE.md) — one sync attempt, and what changed from the snapshots.
4. [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) — the 10 tests, the commands, and eight mutations the suite does not catch.
5. [05-PRACTICE](05-PRACTICE.md) — nine Goal + Check exercises; four have you write the missing tests. Predict before reading [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md), which also lists five verified findings.
6. [07-TRACE-LAB](07-TRACE-LAB.md) — draw the A/B/logout timelines.
7. [VERIFICATION](VERIFICATION.md) — what ran, when, and what did not.

## Running the tests

```text
npm install
npm test               # vitest run --pool=forks --maxWorkers=1  (10 tests)
npm run typecheck
```

The tests use controlled promises for network interleavings and a mocked `expo-sqlite` for the transaction contract. They do not run an Expo device or prove native SQLite durability.

## Source excerpt

From [src/lib/sync.ts](../src/lib/sync.ts), lines 31-55.

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
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)
