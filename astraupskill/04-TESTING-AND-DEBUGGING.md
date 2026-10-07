# Make the late response deterministic

## Test inventory (counted 2026-10-06)

| File | `it(` cases | What it covers |
|---|---|---|
| `src/lib/sync.test.ts` | 6 | coordinator: in-flight survival, serialization, stale success, stale 401, profile update, adoption mode |
| `src/lib/storage.test.ts` | 2 | `commitSyncedProgress` against a mocked `expo-sqlite` (`vi.mock`, line 42): one transaction, and rollback when the adapter throws |
| `src/core/events.test.ts` | 2 | reducer replay after reload; guest overlay de-duplicated by event id |
| **Total** | **10** | |

Commands (need `npm install` first; this repo has no `node_modules` in git):

```text
npm test                                  # vitest run --pool=forks --maxWorkers=1
npx vitest run src/lib/sync.test.ts       # just the coordinator
npm run typecheck                         # tsc --noEmit
```

## How the race is reproduced

The synchronization tests hold a push response on a promise, add an event while the request is pending, then release the response. In the first test (`sync.test.ts:66-80`) the acknowledgement contains only the sent id `a`, and the newly appended `b` must remain in the outbox. This reproduces the race directly instead of relying on network timing or a sleep.

The second test (lines 82-113) starts two overlapping `sync()` calls and tracks active requests: the maximum must stay one, and the queued pass must send only `b`. The third (115-130) replaces the session with a *different user* before releasing a successful response and asserts nothing is committed. The fourth (132-148) rejects the stale push with 401 and asserts `refresh` is never called. The fifth (150-167) checks `applyUserUpdate` after logout returns `null`, then that a refreshed access token survives a late profile response.

Storage tests use a mocked Expo SQLite adapter to verify the transaction contract and rollback behavior *modeled by that fixture*. A real device restart or native database failure needs its own verification.

## What the suite does not pin down

On 2026-10-06 each line below was mutated in a scratch copy of `sync.ts` and the six coordinator tests were re-run (through a small `node:test` shim of the Vitest API, because Vitest is not installed in the clean clone — see [VERIFICATION.md](VERIFICATION.md)). All of these mutations left **6/6 passing**:

| Mutation in `sync.ts` | Why no test notices |
|---|---|
| line 101: commit `result.acknowledgedIds` without the intersection | no test returns an id that was not sent |
| line 99: drop `requestedGeneration !== this.generation` | tests switch to a different user, so the user-id half catches it |
| line 99: drop the user-id half instead | the generation half catches it |
| line 93: drop the post-refresh generation check | no test changes session *during* `refresh` |
| line 80: drop the queued-operation generation check | no test switches session between `sync()` and the queued start |
| line 103: publish `batch` instead of re-reading the outbox | `onCommit` is a bare `vi.fn()` and is never asserted |
| line 75: store `operation` itself as the tail | no test makes one attempt fail and then syncs again |
| line 62: drop the generation check in `applyUserUpdate` | the logout case has `this.tokens === null`, so the user-id check returns `null` anyway |

These are not bugs in the code; they are guarantees the docs describe that the tests do not yet prove. [05-PRACTICE.md](05-PRACTICE.md) turns several into exercises.

## Debugging

Distinguish a coordinator early-return, an API failure, and a storage commit failure; they happen at different points and imply different things about whether progress changed. Note that the provider swallows sync errors (`progress.tsx:87` and `:103`, `.catch(() => {})`), so a failing sync is silent in the UI apart from `pendingCount` not dropping.

## Source excerpt

From [src/lib/sync.test.ts](../src/lib/sync.test.ts), lines 82-113.

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
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)
