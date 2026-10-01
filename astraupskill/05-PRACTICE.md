# Exercises across the asynchronous boundary

First, start with outbox A and a baseline of zero. Block the push, append event B, then acknowledge A. Predict the persisted baseline, remaining outbox, and the event list supplied to the derived-state calculation. Explain why publishing a captured copy of the original outbox is wrong.

Second, return acknowledgements for A and C even though only A was sent. Predict which identifiers the coordinator passes to commit. Describe a test that would fail if the sent-batch intersection were removed.

Third, issue a sync for account A, switch to account B, and then release A's successful response. Repeat with a 401 response instead. State which callbacks may run in each case, including refresh and onTokens. Do not treat matching user identifiers after a later re-login as proof that the original session is still valid.

Fourth, capture a timezone update, refresh the account's access token, and release the timezone response. Explain which user fields and credentials should survive. Then repeat with logout before the response and predict the result.

Finally, compare guest adoption with a direct signed-in account switch. Which path preserves pending guest activity, and which path clears the previous user's baseline and outbox? Write assertions at both the coordinator and provider boundaries. A pure adoption-mode test describes the decision; verifying the provider's actual clearing behavior is a separate integration concern.

## Source excerpt

From [src/lib/sync.test.ts](../src/lib/sync.test.ts).

```ts
  it("does not refresh a stale 401 after the account changes", async () => {
    let rejectPush!: (error: unknown) => void;
    const push = vi.fn(
      () => new Promise<ProgressSyncResult>((_resolve, reject) => (rejectPush = reject)),
    );
    const f = fixture([event("a")], push);
    const coordinator = new ProgressSyncCoordinator(f.deps, tokens("one"));

    const stale = coordinator.sync();
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    coordinator.setSession(tokens("two"));
    rejectPush({ status: 401 });
    await stale;

    expect(f.deps.refresh).not.toHaveBeenCalled();
    expect(f.commits).toEqual([]);
  });

  it("rejects a delayed profile response after logout and preserves refreshed credentials", () => {
    const coordinator = new ProgressSyncCoordinator(
      fixture([], async () => ({ progress: progress(0), acknowledgedIds: [] })).deps,
      tokens("one"),
    );
    const stale = coordinator.currentSession()!;
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)
