import { describe, expect, it } from "vitest";
import { reduceEvents, type ProgressEvent, type UserProgress } from "./events";

const completion: ProgressEvent = {
  id: "00000000-0000-4000-8000-000000000001",
  type: "lesson_completed",
  lessonId: "lesson-1",
  occurredAt: Date.parse("2026-07-09T10:00:00Z"),
  perfect: true,
  xp: 15,
};

describe("offline progress replay", () => {
  it("rebuilds the same progress after an outbox save and reload", () => {
    const reloaded = JSON.parse(JSON.stringify([completion])) as ProgressEvent[];
    const now = Date.parse("2026-07-09T12:00:00Z");
    expect(reduceEvents(reloaded, "UTC", now)).toEqual(
      reduceEvents([completion], "UTC", now),
    );
  });

  it("overlays guest progress on account baseline once when a retry repeats its id", () => {
    const baseline: UserProgress = {
      xpTotal: 100,
      completedLessonIds: ["account-lesson"],
      streak: { count: 1, lastDay: "2026-07-08" },
      hearts: { hearts: 4, updatedAt: completion.occurredAt },
      lessonsCompleted: 1,
      perfectLessons: 0,
      practiceCount: 0,
      xpByDay: { "2026-07-08": 100 },
      longestStreak: 1,
      dailyGoalXp: 30,
    };

    const merged = reduceEvents(
      [completion, { ...completion }],
      "UTC",
      Date.parse("2026-07-09T12:00:00Z"),
      baseline,
    );
    expect(merged.xpTotal).toBe(115);
    expect(merged.completedLessonIds).toEqual(["account-lesson", "lesson-1"]);
    expect(merged.lessonsCompleted).toBe(2);
  });
});
