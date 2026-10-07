# Commit the baseline with its acknowledgement

Follow one sync attempt from queue to publication. The coordinator captures the active generation when sync is called, chains the operation after the previous attempt, and catches rejection only on its internal tail. The caller still receives the operation promise. A failed attempt therefore does not poison all future sync requests.

When the operation starts, it reads at most five hundred outbox events and sends that batch with the active credentials. A 401 can trigger one refresh if the generation is still current. Other failures propagate without pretending progress was committed. After a successful push, the final generation and user checks run before any local acknowledgement.

The returned identifiers are intersected with the sent batch. `commitSyncedProgress` writes the new baseline and deletes those identifiers in one SQLite transaction. Publishing reads the remaining outbox after the commit (`sync.ts:103`), so newly recorded events are preserved in the displayed state.

What changed relative to the original provider ([snapshot](snapshots/src__lib__progress.tsx.original.txt)): the inline sync logic in `progress.tsx` was replaced by the coordinator (`progress.tsx:42-69`), and the separate baseline write plus `outboxClear` were replaced by the single-transaction `commitSyncedProgress` (`storage.ts:42-52`, absent from [the storage snapshot](snapshots/src__lib__storage.ts.original.txt)).

The provider's adoption and logout paths invalidate old work before replacing account data. Guest-to-account adoption keeps guest events for synchronization; account A to account B wipes A's baseline and outbox. The delayed timezone response goes through applyUserUpdate instead of assigning captured credentials directly. These changes address different races with the same ownership principle: asynchronous results may mutate local account state only while their issuing session remains active.

## Source excerpt

From [src/lib/sync.ts](../src/lib/sync.ts), lines 79-105.

```ts
  private async runOnce(requestedGeneration: number): Promise<void> {
    if (requestedGeneration !== this.generation) return;
    let tokens = this.tokens;
    if (!tokens) return;
    const batch = this.dependencies.readOutbox().slice(0, 500);
    let result: ProgressSyncResult;
    try {
      result = await this.dependencies.push(tokens, batch);
    } catch (error) {
      if (!error || typeof error !== "object" || !("status" in error) || error.status !== 401) {
        throw error;
      }
      if (requestedGeneration !== this.generation) return;
      const fresh = await this.dependencies.refresh(tokens.refreshToken);
      if (requestedGeneration !== this.generation) return;
      tokens = fresh;
      this.tokens = fresh;
      this.dependencies.onTokens(fresh);
      result = await this.dependencies.push(fresh, batch);
    }
    if (requestedGeneration !== this.generation || this.tokens?.user.id !== tokens.user.id) return;
    const requestedIds = new Set(batch.map((event) => event.id));
    const acknowledgedIds = result.acknowledgedIds.filter((id) => requestedIds.has(id));
    this.dependencies.commit(result.progress, acknowledgedIds);
    this.dependencies.onCommit(result.progress, this.dependencies.readOutbox());
  }
}
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)
