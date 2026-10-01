# Make the late response deterministic

The synchronization tests hold a push response on a promise, add an event while the request is pending, then release the response. The expected acknowledgement contains only the original sent identifier, while the new event remains in the outbox. This reproduces the race directly instead of relying on network timing or a fixed sleep.

A second test starts overlapping sync calls and tracks active requests. The maximum must remain one, and the queued pass must read the remainder after the earlier commit. Account-change tests replace the session before releasing a response and assert that no baseline or acknowledgement is committed. Another case rejects the stale push with 401 and verifies that refresh is never called.

Profile-update tests capture a session, log out, and attempt to apply a delayed user response. The result must be null. They then establish an active session, update its access token, and apply a profile response captured before that refresh. The new token must survive.

Storage tests use a mock Expo SQLite adapter to verify the transaction contract and rollback behavior modeled by that fixture. That is useful regression evidence, but a real device restart or native database failure needs its own verification. When debugging, distinguish a coordinator rejection, an API failure, and a storage commit failure; they occur at different points and support different conclusions about whether progress changed.

## Source excerpt

From [src/lib/sync.test.ts](../src/lib/sync.test.ts).

```ts
  it("serializes overlaps and lets the queued pass flush the remainder", async () => {
    let releaseFirst!: (value: UserProgress) => void;
    let active = 0;
    let maxActive = 0;
    const push = vi.fn(async (_tokens: AuthTokens, events: ProgressEvent[]) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (push.mock.calls.length === 1) {
        const released = await new Promise<UserProgress>((resolve) => (releaseFirst = resolve));
        active -= 1;
        return { progress: released, acknowledgedIds: events.map((event) => event.id) };
      }
      active -= 1;
      return {
        progress: progress(events.length * 10),
        acknowledgedIds: events.map((event) => event.id),
      };
    });
    const f = fixture([event("a")], push);
    const coordinator = new ProgressSyncCoordinator(f.deps, tokens("one"));

    const first = coordinator.sync();
    const second = coordinator.sync();
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    f.append(event("b"));
    releaseFirst(progress(10));
    await Promise.all([first, second]);

    expect(maxActive).toBe(1);
    expect(push.mock.calls[1]![1].map((item) => item.id)).toEqual(["b"]);
    expect(f.outbox()).toEqual([]);
  });

  it("discards a response after logout or account replacement", async () => {
    let resolveResult!: (value: ProgressSyncResult) => void;
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)
