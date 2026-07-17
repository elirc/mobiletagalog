import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ACHIEVEMENTS,
  DEFAULT_DAILY_GOAL_XP,
  displayStreak,
  earnedAchievementIds,
  levelProgress,
  localDayKey,
  type AchievementDef,
} from "@/core";
import { getBundle } from "@/content";
import { deviceTz, newEventId, useProgress } from "@/lib/progress";
import { font, radii, spacing, useTheme, type Scheme } from "@/theme";

/**
 * Stats: XP/level/streak tiles, the daily goal editor, a 14-day XP chart and
 * the achievement grid. Every color is read through useTheme() — including in
 * the small helpers below — so the whole screen flips with the scheme; a
 * module-scope palette import would freeze it in light mode.
 */

const GOAL_PRESETS = [
  { xp: 10, label: "Casual" },
  { xp: 20, label: "Regular" },
  { xp: 30, label: "Serious" },
  { xp: 50, label: "Intense" },
] as const;

const SCHEMES: readonly { value: Scheme; label: string }[] = [
  { value: "light", label: "☀️ Light" },
  { value: "dark", label: "🌙 Dark" },
  { value: "system", label: "⚙️ System" },
];

const TIERS: readonly { tier: 1 | 2 | 3; name: string }[] = [
  { tier: 1, name: "Early wins" },
  { tier: 2, name: "Momentum" },
  { tier: 3, name: "Long haul" },
];

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"] as const;

const CHART_DAYS = 14;
const CHART_HEIGHT = 100;
/**
 * Headroom above the tallest bar. The goal line is scaled into the chart too,
 * so without it a goal-is-the-max chart (the common no-XP case) would pin the
 * line to the top edge and clip its label.
 */
const CHART_HEADROOM = 1.25;

/** Weekday initial for a "YYYY-MM-DD" key without relying on Intl. */
function weekdayInitial(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return WEEKDAY[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()] ?? "";
}

/** The day key `n` calendar days before `todayKey` — pure key math, DST-safe. */
function dayKeyMinus(todayKey: string, n: number): string {
  const [y, m, d] = todayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!) - n * 86_400_000);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/* --------------------------------- helpers ---------------------------------- */

function Bar({ pct, color, height = 10 }: { pct: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ height, backgroundColor: colors.border, borderRadius: radii.pill, overflow: "hidden" }}>
      <View
        style={{
          width: `${clamped}%`,
          height: "100%",
          backgroundColor: color ?? colors.primary,
          borderRadius: radii.pill,
        }}
      />
    </View>
  );
}

function StatTile({ children }: { children: ReactNode }) {
  const { styles } = useTheme();
  return <View style={[styles.card, { width: "48%", padding: spacing.sm, gap: spacing.xs }]}>{children}</View>;
}

function TileLabel({ children }: { children: ReactNode }) {
  const { styles } = useTheme();
  return <Text style={styles.muted}>{children}</Text>;
}

function TileValue({ children, color }: { children: ReactNode; color?: string }) {
  const { colors } = useTheme();
  return <Text style={{ fontSize: font.sizeLg, fontWeight: "800", color: color ?? colors.text }}>{children}</Text>;
}

/** Segmented pill used by both the goal presets and the appearance picker. */
function SegBtn({
  selected,
  label,
  sub,
  onPress,
  accessibilityLabel,
}: {
  selected: boolean;
  label: string;
  sub?: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: radii.md,
        borderWidth: 2,
        alignItems: "center",
        // primaryFill is the palette's "fill under white text" in both schemes
        borderColor: selected ? colors.primaryFill : colors.border,
        backgroundColor: selected ? colors.primaryFill : colors.bg,
      }}
    >
      <Text style={{ fontWeight: "800", color: selected ? "#fff" : colors.text }}>{label}</Text>
      {sub ? (
        <Text style={{ fontSize: 11, fontWeight: "600", color: selected ? "#fff" : colors.textMuted }}>{sub}</Text>
      ) : null}
    </Pressable>
  );
}

function TierHeader({ tier, name, got, total }: { tier: 1 | 2 | 3; name: string; got: number; total: number }) {
  const { colors, styles } = useTheme();
  const dot = tier === 1 ? colors.primary : tier === 2 ? colors.accent : colors.warningText;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
      <View style={{ width: 10, height: 10, borderRadius: radii.pill, backgroundColor: dot }} />
      <Text style={{ fontWeight: "800", color: colors.text }}>Tier {tier}</Text>
      <Text style={styles.muted}>{name}</Text>
      <View style={{ flex: 1 }} />
      <Text style={styles.muted}>
        {got}/{total}
      </Text>
    </View>
  );
}

function AchievementCard({ def, earned }: { def: AchievementDef; earned: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={`${def.title}, ${earned ? "earned" : "locked"}: ${def.description}`}
      style={{
        width: "48%",
        borderWidth: 2,
        borderRadius: radii.md,
        padding: spacing.sm,
        gap: 2,
        alignItems: "center",
        borderColor: earned ? colors.primary : colors.border,
        backgroundColor: earned ? colors.primarySoft : colors.bgMuted,
      }}
    >
      <Text style={{ fontSize: 26 }}>{earned ? def.emoji : "❔"}</Text>
      <Text
        style={{
          fontWeight: "800",
          textAlign: "center",
          color: earned ? colors.text : colors.textMuted,
        }}
      >
        {def.title}
      </Text>
      <Text style={{ fontSize: 12, textAlign: "center", color: colors.textMuted }}>{def.description}</Text>
    </View>
  );
}

/* ---------------------------------- screen ---------------------------------- */

export default function StatsScreen() {
  const router = useRouter();
  const { progress, addEvents } = useProgress();
  const { colors, styles, scheme, setScheme } = useTheme();
  const bundle = getBundle();

  const now = Date.now();
  const tz = deviceTz();
  const todayKey = localDayKey(now, tz);

  const { level, xpIntoLevel, xpForNextLevel } = levelProgress(progress.xpTotal);
  const levelPct = xpForNextLevel > 0 ? (xpIntoLevel / xpForNextLevel) * 100 : 100;
  const streak = displayStreak(progress.streak, todayKey);

  // an older server baseline can carry a missing/zero goal — a 0 goal would
  // make "goal met" trivially true and divide the chart by zero
  const goal = progress.dailyGoalXp || DEFAULT_DAILY_GOAL_XP;
  const todayXp = progress.xpByDay[todayKey] ?? 0;
  const goalPct = goal > 0 ? (todayXp / goal) * 100 : 0;
  const goalReached = todayXp >= goal && todayXp > 0;

  // derive prior days from todayKey, not `now − 24h·n`: a 23/25-hour DST day
  // would duplicate one key and drop another
  const last14 = Array.from({ length: CHART_DAYS }, (_, i) => {
    const key = dayKeyMinus(todayKey, CHART_DAYS - 1 - i);
    return { key, xp: progress.xpByDay[key] ?? 0 };
  });
  const chartTotal = last14.reduce((sum, d) => sum + d.xp, 0);
  // scale to the goal too, so the reference line is always on the chart
  const chartMax = Math.max(goal, ...last14.map((d) => d.xp), 1) * CHART_HEADROOM;
  const goalLineY = CHART_HEIGHT * (goal / chartMax);

  const earned = new Set(earnedAchievementIds(progress, bundle.units));

  const setGoal = (goalXp: number) => {
    if (goalXp === goal) return;
    addEvents([{ id: newEventId(), type: "goal_set", occurredAt: Date.now(), goalXp }]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: colors.bg,
          borderBottomWidth: 2,
          borderBottomColor: colors.border,
          gap: spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="back">
          <Text style={{ fontSize: 22, color: colors.textMuted }}>‹ Back</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>📊 Stats</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Stat tiles */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.md }}>
          <StatTile>
            <TileLabel>Total XP</TileLabel>
            <TileValue color={colors.warningText}>⚡ {progress.xpTotal}</TileValue>
          </StatTile>

          <StatTile>
            <TileLabel>Level</TileLabel>
            <TileValue color={colors.primary}>Lv {level}</TileValue>
            <Bar pct={levelPct} />
            <Text style={styles.muted}>
              {xpIntoLevel}/{xpForNextLevel} to Lv {level + 1}
            </Text>
          </StatTile>

          <StatTile>
            <TileLabel>Streak</TileLabel>
            <TileValue color={colors.heart}>🔥 {streak}</TileValue>
            <Text style={styles.muted}>
              Longest {progress.longestStreak} day{progress.longestStreak === 1 ? "" : "s"}
            </Text>
          </StatTile>

          <StatTile>
            <TileLabel>Today</TileLabel>
            <TileValue color={goalReached ? colors.primary : undefined}>🎯 {todayXp}</TileValue>
            <Text style={styles.muted}>of {goal} XP goal</Text>
          </StatTile>

          <StatTile>
            <TileLabel>Lessons done</TileLabel>
            <TileValue>📚 {progress.lessonsCompleted}</TileValue>
          </StatTile>

          <StatTile>
            <TileLabel>Perfect lessons</TileLabel>
            <TileValue>✨ {progress.perfectLessons}</TileValue>
          </StatTile>

          <StatTile>
            <TileLabel>Practice runs</TileLabel>
            <TileValue>🔁 {progress.practiceCount}</TileValue>
          </StatTile>
        </View>

        {/* Daily goal */}
        <View style={[styles.card, { gap: spacing.sm }]}>
          <Text style={styles.subtitle}>Daily goal</Text>
          <Text style={styles.body}>
            {todayXp} / {goal} XP today
            {goalReached ? "  🎯" : ""}
          </Text>
          <Bar pct={goalPct} color={goalReached ? colors.primary : colors.warning} height={14} />
          <Text style={styles.muted}>Pick a target that keeps your streak going.</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {GOAL_PRESETS.map((p) => (
              <SegBtn
                key={p.xp}
                selected={p.xp === goal}
                label={String(p.xp)}
                sub={p.label}
                onPress={() => setGoal(p.xp)}
                accessibilityLabel={`set daily goal ${p.xp} xp`}
              />
            ))}
          </View>
        </View>

        {/* Last 14 days */}
        <View style={[styles.card, { gap: spacing.sm }]}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text style={styles.subtitle}>Last 14 days</Text>
            <Text style={styles.muted}>{chartTotal} XP</Text>
          </View>

          <View style={{ height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
            {last14.map((d) => {
              const isToday = d.key === todayKey;
              const barH = d.xp > 0 ? Math.max(4, Math.round(CHART_HEIGHT * (d.xp / chartMax))) : 3;
              return (
                <View
                  key={d.key}
                  style={{
                    flex: 1,
                    height: barH,
                    borderRadius: 3,
                    backgroundColor: d.xp === 0 ? colors.border : isToday ? colors.accent : colors.primary,
                  }}
                />
              );
            })}

            {/* goal reference line — dashes as flex cells, so it spans any width */}
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: goalLineY,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              {Array.from({ length: 29 }, (_, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 1.5,
                    backgroundColor: i % 2 === 0 ? colors.textMuted : "transparent",
                  }}
                />
              ))}
            </View>
            <Text
              style={{
                position: "absolute",
                right: 0,
                bottom: goalLineY + 3,
                fontSize: 10,
                fontWeight: "700",
                color: colors.textMuted,
              }}
            >
              goal {goal}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 3 }}>
            {last14.map((d) => {
              const isToday = d.key === todayKey;
              return (
                <Text
                  key={d.key}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: isToday ? "800" : "600",
                    color: isToday ? colors.accent : colors.textMuted,
                  }}
                >
                  {weekdayInitial(d.key)}
                </Text>
              );
            })}
          </View>

          {chartTotal === 0 ? (
            <Text style={styles.muted}>Complete a lesson to start earning XP.</Text>
          ) : (
            <Text style={styles.muted}>
              Today: <Text style={{ color: colors.accent, fontWeight: "800" }}>{todayXp} XP</Text> · 14-day total:{" "}
              {chartTotal} XP
            </Text>
          )}
        </View>

        {/* Achievements */}
        <View style={[styles.card, { gap: spacing.md }]}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text style={styles.subtitle}>Achievements</Text>
            <Text style={styles.muted}>
              {earned.size}/{ACHIEVEMENTS.length}
            </Text>
          </View>

          {TIERS.map(({ tier, name }) => {
            const defs = ACHIEVEMENTS.filter((a) => a.tier === tier);
            const got = defs.filter((a) => earned.has(a.id)).length;
            return (
              <View key={tier}>
                <TierHeader tier={tier} name={name} got={got} total={defs.length} />
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    rowGap: spacing.sm,
                  }}
                >
                  {defs.map((a) => (
                    <AchievementCard key={a.id} def={a} earned={earned.has(a.id)} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* Appearance */}
        <View style={[styles.card, { gap: spacing.sm }]}>
          <Text style={styles.subtitle}>Appearance</Text>
          <Text style={styles.muted}>System follows your device's light/dark setting.</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {SCHEMES.map((s) => (
              <SegBtn
                key={s.value}
                selected={scheme === s.value}
                label={s.label}
                onPress={() => setScheme(s.value)}
                accessibilityLabel={`use ${s.value} theme`}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
