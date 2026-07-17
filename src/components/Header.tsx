import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { displayStreak, levelForXp, localDayKey, MAX_HEARTS, regenerate } from "@/core";
import { deviceTz, useProgress } from "@/lib/progress";
import { radii, spacing, useTheme } from "@/theme";

/**
 * App bar: level, streak, XP, hearts, plus links to the phrasebook and stats.
 * Mirrors the web header so the two apps read the same at a glance.
 */
export function Header({ title }: { title?: string }) {
  const router = useRouter();
  const { progress, pendingCount } = useProgress();
  const { colors } = useTheme();

  const now = Date.now();
  const hearts = regenerate(progress.hearts, now).hearts;
  const streak = displayStreak(progress.streak, localDayKey(now, deviceTz()));
  const level = levelForXp(progress.xpTotal);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.bg,
        borderBottomWidth: 2,
        borderBottomColor: colors.border,
        gap: spacing.sm,
      }}
    >
      <Pressable onPress={() => router.push("/")} accessibilityLabel="course map">
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primaryDark }}>
          {title ?? "Aral"}
        </Text>
      </Pressable>
      <View
        style={{
          backgroundColor: colors.primaryFill,
          borderRadius: radii.pill,
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>Lv {level}</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Text style={{ fontWeight: "700", color: colors.text }}>🔥 {streak}</Text>
      {/* amber as text needs warningText — raw #ffc800 is ~1.6:1 on white */}
      <Text style={{ fontWeight: "700", color: colors.warningText }}>⚡ {progress.xpTotal}</Text>
      <Text style={{ fontWeight: "700", color: colors.heart }}>
        ❤️ {hearts}/{MAX_HEARTS}
      </Text>
      {pendingCount > 0 && (
        <Text style={{ color: colors.textMuted, fontSize: 12 }} accessibilityLabel="changes waiting to sync">
          ⟳ {pendingCount}
        </Text>
      )}
      <Pressable onPress={() => router.push("/words")} accessibilityLabel="phrasebook">
        <Text style={{ fontSize: 20 }}>📖</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/stats")} accessibilityLabel="view stats">
        <Text style={{ fontSize: 20 }}>📊</Text>
      </Pressable>
    </View>
  );
}
