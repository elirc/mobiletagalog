# Exercises across the asynchronous boundary

Every exercise has a **Goal** and a **Check**. Runnable checks need `npm install` once, then `npx vitest run src/lib/sync.test.ts` (6 tests, all passing on an unmodified tree). Break-it exercises edit `src/lib/sync.ts`; work on a scratch branch and `git restore src/lib/sync.ts` afterwards. Write your prediction first; answers are in [06-SOLUTIONS-AND-REVIEW.md](06-SOLUTIONS-AND-REVIEW.md).

## 1. In-flight event survives

**Goal:** start with outbox `[A]` and no baseline. Block the push, append `B`, then acknowledge `A`. Predict the persisted baseline, the remaining outbox, and the list passed to `onCommit`. Explain why publishing a captured copy of the original outbox would be wrong.
**Check (runnable):** test 1 (`sync.test.ts:66-80`) asserts the commit and the outbox. Then read exercise 5 — the `onCommit` part of your answer is *not* asserted anywhere.

## 2. Break the 401 guard

**Goal:** delete line 91 (`if (requestedGeneration !== this.generation) return;` inside the `catch`). Predict which of the six tests fails and on which assertion.
**Check (runnable):** run the coordinator tests.

## 3. Break the final guard

**Goal:** delete line 99 entirely. Predict which test fails.
**Check (runnable):** run the coordinator tests.

## 4. A guard nobody tests: the intersection

**Goal:** replace `result.acknowledgedIds.filter((id) => requestedIds.has(id))` on line 101 with `result.acknowledgedIds`. Predict the test result. Then write a seventh test: start with outbox `[A]`, block the push, append `C` in flight, and resolve the push with `acknowledgedIds: ["a", "c"]` while `C` is appended in flight; assert `f.commits` equals `[["a"]]` and `C` is still in the outbox.
**Check (runnable):** your new test passes on the real code **and** fails with the mutation applied. A test that passes both ways proves nothing.

## 5. A guard nobody tests: the fresh re-read

**Goal:** change line 103 to `this.dependencies.onCommit(result.progress, batch);`. Predict the result. Then add an assertion to test 1 that `f.deps.onCommit` was last called with a remainder whose ids are `["b"]`.
**Check (runnable):** the strengthened test passes on the real code and fails with the mutation.

## 6. Same user, new session (senior)

**Goal:** remove only the `requestedGeneration !== this.generation ||` part of line 99. Predict the result. Then write the test the docs describe but the suite lacks: `sync()` as user `one`, `setSession(null)`, `setSession(tokens("one"))`, then release the old response. Assert nothing was committed.
**Check (runnable):** the new test fails with the mutation and passes on the real code.

## 7. A failed attempt must not poison the queue

**Goal:** make the first push reject with a non-401 error, then call `sync()` again and let the second push succeed. Predict whether the second attempt runs. Then change line 75 to `this.tail = operation;` and predict again.
**Check (runnable):** write the test; it must pass on the real code and fail with the line-75 mutation.

## 8. Timezone after refresh

**Goal:** capture a timezone update, refresh the access token, release the profile response. Which user fields and credentials survive? Repeat with logout first.
**Check (runnable):** test 5 (`sync.test.ts:150-167`) covers both halves. Explain why deleting the generation check on line 62 does *not* break it (hint: what is `this.tokens` after `setSession(null)`?).

## 9. Guest adoption vs account switch (senior)

**Goal:** compare `authAdoptionMode(null, "b")` with `authAdoptionMode("a", "b")` and trace what `adoptAuth` (`progress.tsx:90-104`) does with each. Which path preserves pending guest activity?
**Check (source + runnable):** test 6 covers the decision function only. In your write-up, name what a provider-level test would need to mock (`./storage`, `./api`) to prove `wipeAll` runs only for `account-switch`; the repo has no such test.

## Source excerpt

From [src/lib/sync.test.ts](../src/lib/sync.test.ts), lines 132-148.

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
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)
