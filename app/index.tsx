import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  DEFAULT_DAILY_GOAL_XP,
  displayStreak,
  localDayKey,
  type Lesson,
  type Unit,
} from "@/core";
import { Header } from "@/components/Header";
import { getBundle } from "@/content";
import { deviceTz, useProgress } from "@/lib/progress";
import { radii, spacing, useTheme } from "@/theme";

const UNIT_COLORS = ["#4a8f00", "#1cb0f6", "#ce82ff", "#ff9600", "#ff4b4b", "#2bb6a3"];

function findNext(units: Unit[], done: Set<string>): { unit: Unit; lesson: Lesson; unitIndex: number } | null {
  for (let ui = 0; ui < units.length; ui++) {
    const unit = units[ui]!;
    const lesson = unit.lessons.find((l) => !done.has(l.id));
    if (lesson) return { unit, lesson, unitIndex: ui };
  }
  return null;
}

export default function CourseMapScreen() {
  const { progress, user, logout } = useProgress();
  const { colors, styles } = useTheme();
  const bundle = getBundle();

  const done = new Set(progress.completedLessonIds);
  const next = findNext(bundle.units, done);
  const now = Date.now();
  const tz = deviceTz();
  const todayXp = progress.xpByDay[localDayKey(now, tz)] ?? 0;
  const goal = progress.dailyGoalXp || DEFAULT_DAILY_GOAL_XP;
  const streak = displayStreak(progress.streak, localDayKey(now, tz));
  const started = progress.lessonsCompleted > 0;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header />
      <ScrollView contentContainerStyle={styles.container}>
        {!user && (
          <Text style={styles.muted}>
            Playing as guest —{" "}
            <Link href="/register" style={{ color: colors.accent }}>
              create an account
            </Link>{" "}
            to back up progress.
          </Text>
        )}

        {/* one obvious next action, instead of hunting through 15 units */}
        {next ? (
          <ContinueHero
            kicker={started ? "Jump back in" : "Start here"}
            title={next.lesson.title}
            subtitle={`Unit ${next.unitIndex + 1} · ${next.unit.title}${streak > 0 ? ` · 🔥 ${streak}-day streak` : ""}`}
            cta={`${started ? "Continue" : "Start learning"}  +${next.lesson.xp} XP`}
            lessonId={next.lesson.id}
            todayXp={todayXp}
            goal={goal}
          />
        ) : (
          <ContinueHero
            kicker="Course complete"
            title="You finished every lesson! 🏆"
            subtitle="Replay any lesson below to practice and earn hearts back."
            todayXp={todayXp}
            goal={goal}
          />
        )}

        {bundle.units.map((unit, ui) => (
          <UnitCard
            key={unit.id}
            unit={unit}
            index={ui}
            done={done}
            nextLessonId={next?.lesson.id ?? null}
            startOpen={next?.unit.id === unit.id}
          />
        ))}

        {user ? (
          <Pressable style={styles.btnGhost} onPress={logout}>
            <Text style={styles.btnGhostText}>Log out ({user.email})</Text>
          </Pressable>
        ) : (
          <Link href="/login" asChild>
            <Pressable style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Log in</Text>
            </Pressable>
          </Link>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ContinueHero({
  kicker,
  title,
  subtitle,
  cta,
  lessonId,
  todayXp,
  goal,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  cta?: string;
  lessonId?: string;
  todayXp: number;
  goal: number;
}) {
  const router = useRouter();
  const { colors, styles } = useTheme();
  return (
    <View style={[styles.card, { borderColor: colors.primary, gap: spacing.sm }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              color: colors.primaryDark,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            {kicker}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>{title}</Text>
          <Text style={styles.muted}>{subtitle}</Text>
        </View>
        <GoalDial todayXp={todayXp} goal={goal} />
      </View>
      {cta && lessonId && (
        <Pressable style={styles.btnPrimary} onPress={() => router.push(`/lesson/${lessonId}`)}>
          <Text style={styles.btnPrimaryText}>{cta}</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Daily-goal dial. The web build draws an SVG ring; adding a native SVG
 * dependency for one widget isn't worth it, so this is a plain circular
 * track with the number inside and a bar underneath carrying the progress.
 */
function GoalDial({ todayXp, goal }: { todayXp: number; goal: number }) {
  const { colors } = useTheme();
  const pct = goal > 0 ? Math.min(100, (todayXp / goal) * 100) : 100;
  const met = todayXp >= goal && todayXp > 0;
  return (
    <View style={{ alignItems: "center", width: 84, gap: 6 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          borderWidth: 5,
          borderColor: met ? colors.warning : colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: met ? 22 : 18, fontWeight: "800", color: colors.text }}>
          {met ? "🎯" : todayXp}
        </Text>
      </View>
      <View
        style={{
          width: "100%",
          height: 6,
          borderRadius: radii.pill,
          backgroundColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: met ? colors.warning : colors.primary,
          }}
        />
      </View>
      <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textMuted }}>
        {todayXp}/{goal} XP
      </Text>
    </View>
  );
}

function UnitCard({
  unit,
  index,
  done,
  nextLessonId,
  startOpen,
}: {
  unit: Unit;
  index: number;
  done: Set<string>;
  nextLessonId: string | null;
  startOpen: boolean;
}) {
  // only the unit in progress opens by default — 15 units is a lot to scroll
  const [open, setOpen] = useState(startOpen);
  const router = useRouter();
  const { colors, styles } = useTheme();

  const total = unit.lessons.length;
  const doneCount = unit.lessons.filter((l) => done.has(l.id)).length;
  const pct = total > 0 ? (doneCount / total) * 100 : 0;
  const color = UNIT_COLORS[index % UNIT_COLORS.length]!;

  return (
    <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${unit.title}, ${doneCount} of ${total} lessons done`}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radii.md,
            backgroundColor: color,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>{unit.title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View
              style={{
                flex: 1,
                maxWidth: 140,
                height: 8,
                borderRadius: radii.pill,
                backgroundColor: colors.border,
                overflow: "hidden",
              }}
            >
              <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color }} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted }}>
              {doneCount}/{total}
            </Text>
          </View>
        </View>
        {doneCount === total && (
          <Text style={{ color: colors.warningText, fontWeight: "700", fontSize: 12 }}>★ done</Text>
        )}
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{open ? "▲" : "▼"}</Text>
      </Pressable>

      {open && (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          {unit.description ? (
            <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{unit.description}</Text>
          ) : null}
          {unit.tip ? (
            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                backgroundColor: colors.accentSoft,
                borderRadius: radii.md,
                padding: spacing.sm,
                marginBottom: spacing.sm,
              }}
            >
              <Text>💡</Text>
              <Text style={[styles.muted, { flex: 1, color: colors.text }]}>{unit.tip}</Text>
            </View>
          ) : null}

          {unit.lessons.map((lesson) => {
            const isDone = done.has(lesson.id);
            const isNext = lesson.id === nextLessonId;
            const locked = !isDone && !isNext;
            return (
              <View
                key={lesson.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingVertical: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isDone ? colors.warning : isNext ? colors.primaryFill : colors.border,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800" }}>
                    {isDone ? "★" : isNext ? "▶" : "🔒"}
                  </Text>
                </View>
                <Text style={[styles.body, { fontWeight: "600", flex: 1 }]}>{lesson.title}</Text>
                {!locked && (
                  <Pressable
                    style={[styles.btnPrimary, { paddingVertical: 8, paddingHorizontal: 16 }]}
                    onPress={() => router.push(`/lesson/${lesson.id}`)}
                  >
                    <Text style={styles.btnPrimaryText}>{isDone ? "Practice" : "Start"}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
