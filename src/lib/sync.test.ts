import { describe, expect, it, vi } from "vitest";
import type { ProgressEvent, UserProgress } from "@/core";
import type { AuthTokens } from "./api";
import {
  authAdoptionMode,
  ProgressSyncCoordinator,
  type ProgressSyncDependencies,
  type ProgressSyncResult,
} from "./sync";

const event = (id: string): ProgressEvent => ({
  id,
  type: "lesson_completed",
  lessonId: `lesson-${id}`,
  occurredAt: 1,
  perfect: false,
  xp: 10,
});

const progress = (xpTotal: number): UserProgress => ({
  xpTotal,
  completedLessonIds: [],
  streak: { count: 0, lastDay: null },
  hearts: { hearts: 5, updatedAt: 1 },
  lessonsCompleted: 0,
  perfectLessons: 0,
  practiceCount: 0,
  xpByDay: {},
  longestStreak: 0,
  dailyGoalXp: 30,
});

const tokens = (id: string): AuthTokens => ({
  accessToken: `access-${id}`,
  refreshToken: `refresh-${id}`,
  user: { id, email: `${id}@test.local`, tz: "UTC", displayName: null },
});

function fixture(initial: ProgressEvent[], push: ProgressSyncDependencies["push"]) {
  let outbox = [...initial];
  let baseline: UserProgress | null = null;
  const commits: string[][] = [];
  const deps: ProgressSyncDependencies = {
    readOutbox: () => [...outbox],
    push,
    refresh: vi.fn(),
    commit: (next, ids) => {
      baseline = next;
      commits.push(ids);
      const acknowledged = new Set(ids);
      outbox = outbox.filter((item) => !acknowledged.has(item.id));
    },
    onTokens: vi.fn(),
    onCommit: vi.fn(),
  };
  return {
    deps,
    append: (item: ProgressEvent) => outbox.push(item),
    outbox: () => outbox,
    baseline: () => baseline,
    commits,
  };
}

describe("ProgressSyncCoordinator", () => {
  it("commits only acknowledged ids so events added in flight survive", async () => {
    let resolveResult!: (value: ProgressSyncResult) => void;
    const push = vi.fn(() => new Promise<ProgressSyncResult>((resolve) => (resolveResult = resolve)));
    const f = fixture([event("a")], push);
    const coordinator = new ProgressSyncCoordinator(f.deps, tokens("one"));

    const syncing = coordinator.sync();
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    f.append(event("b"));
    resolveResult({ progress: progress(10), acknowledgedIds: ["a"] });
    await syncing;

    expect(f.commits).toEqual([["a"]]);
    expect(f.outbox().map((item) => item.id)).toEqual(["b"]);
  });

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
    const push = vi.fn(() => new Promise<ProgressSyncResult>((resolve) => (resolveResult = resolve)));
    const f = fixture([event("guest")], push);
    const coordinator = new ProgressSyncCoordinator(f.deps, tokens("one"));

    const stale = coordinator.sync();
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    coordinator.setSession(tokens("two"));
    resolveResult({ progress: progress(10), acknowledgedIds: ["guest"] });
    await stale;

    expect(f.commits).toEqual([]);
    expect(f.outbox().map((item) => item.id)).toEqual(["guest"]);
    expect(f.baseline()).toBeNull();
  });

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
