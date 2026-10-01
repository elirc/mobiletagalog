# Answers and review criteria

After acknowledging A, the new server baseline is stored and B remains local. The publication callback receives a fresh read of the remainder. Clearing all outbox rows or publishing the pre-request array would lose B or make its display inconsistent with storage.

For an acknowledgement containing A and C, only A is passed to commit because the sent batch defines the permitted deletion set. The server response cannot authorize removal of an event this request never sent. The fake provider test should include an unrelated acknowledgement to protect that condition explicitly.

After account replacement, both the successful response and stale 401 are discarded before local mutation. The stale 401 must not call refresh. Generation checking also protects logout followed by login to the same user identifier, because identity equality alone would accept that abandoned request.

For a delayed timezone response within the active session, the returned user profile is combined with current credentials. A refreshed access token remains intact. After logout, applyUserUpdate returns null and the provider does not persist or publish the old authentication object.

Guest adoption preserves the outbox so local learning can be synchronized. A direct account switch clears the prior account's outbox and baseline. Review solutions for the ordering of session invalidation and clearing, and for transaction scope around baseline-plus-acknowledgement. Also inspect claims in reports: a mock SQLite contract test is not a native device durability test, and a fake provider does not prove the production server's acceptance semantics.

## Source excerpt

From [src/lib/sync.test.ts](../src/lib/sync.test.ts).

```ts
  it("rejects a delayed profile response after logout and preserves refreshed credentials", () => {
    const coordinator = new ProgressSyncCoordinator(
      fixture([], async () => ({ progress: progress(0), acknowledgedIds: [] })).deps,
      tokens("one"),
    );
    const stale = coordinator.currentSession()!;
    coordinator.setSession(null);
    expect(
      coordinator.applyUserUpdate(stale, { ...stale.tokens.user, tz: "Asia/Manila" }),
    ).toBeNull();

    coordinator.setSession(tokens("one"));
    const active = coordinator.currentSession()!;
    coordinator.updateSessionTokens({ ...tokens("one"), accessToken: "refreshed" });
    expect(
      coordinator.applyUserUpdate(active, { ...active.tokens.user, tz: "Asia/Manila" }),
    ).toMatchObject({ accessToken: "refreshed", user: { tz: "Asia/Manila" } });
  });

  it("distinguishes guest adoption from a true account switch", () => {
    expect(authAdoptionMode(null, "account-b")).toBe("guest");
    expect(authAdoptionMode("account-b", "account-b")).toBe("same-account");
    expect(authAdoptionMode("account-a", "account-b")).toBe("account-switch");
  });
});
```

## Course navigation

[README](README.md) / [01-CODEBASE-MAP](01-CODEBASE-MAP.md) / [02-CONCEPTS](02-CONCEPTS.md) / [03-WORKED-CHANGE](03-WORKED-CHANGE.md) / [04-TESTING-AND-DEBUGGING](04-TESTING-AND-DEBUGGING.md) / [05-PRACTICE](05-PRACTICE.md) / [06-SOLUTIONS-AND-REVIEW](06-SOLUTIONS-AND-REVIEW.md) / [07-TRACE-LAB](07-TRACE-LAB.md) / [VERIFICATION](VERIFICATION.md)
