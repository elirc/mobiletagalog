import { useRouter } from "expo-router";
import { memo, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { VocabEntry } from "@/core";
import { getBundle } from "@/content";
import { playAudio } from "@/lib/audio";
import { font, radii, spacing, useTheme } from "@/theme";

/**
 * Phrasebook: every vocab entry in the course, searchable, with audio.
 * Pure content view — no progress writes, works logged out and offline.
 */
export default function WordsScreen() {
  const router = useRouter();
  const { colors, styles } = useTheme();
  const [query, setQuery] = useState("");

  // Object.values gives a fresh array, so sorting doesn't reorder the bundle.
  const all = useMemo(
    () =>
      Object.values(getBundle().vocab).sort((a, b) =>
        a.lemma.localeCompare(b.lemma, "fil", { sensitivity: "base" }),
      ),
    [],
  );

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      q
        ? all.filter(
            (v) =>
              v.lemma.toLowerCase().includes(q) ||
              v.translation.toLowerCase().includes(q) ||
              (v.notes ?? "").toLowerCase().includes(q),
          )
        : all,
    [q, all],
  );

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
        <Pressable onPress={() => router.back()} accessibilityLabel="back">
          <Text style={{ fontSize: 22, color: colors.textMuted }}>‹ Back</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>📖 Phrasebook</Text>
      </View>

      {/* Search sits outside the FlatList: it stays put while the list scrolls,
          and can't be remounted (losing focus) by a list re-render. */}
      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <TextInput
          style={{
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: radii.md,
            paddingVertical: 12,
            paddingHorizontal: 14,
            fontSize: font.sizeMd,
            backgroundColor: colors.bg,
            // without an explicit color this is near-black on the dark bg
            color: colors.text,
          }}
          placeholder="Search Tagalog or English…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="search words"
        />
        <Text style={styles.muted}>
          {q
            ? `${shown.length} of ${all.length} words`
            : `All ${all.length} words & phrases from the course. Tap 🔊 to hear them.`}
        </Text>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <WordRow entry={item} />}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.lg,
          gap: spacing.sm,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text style={[styles.muted, { textAlign: "center", paddingVertical: spacing.xl }]}>
            No matches for “{query.trim()}”.
          </Text>
        }
      />
    </SafeAreaView>
  );
}

/** One vocab row: audio button, lemma, translation, and notes when present. */
const WordRow = memo(function WordRow({ entry }: { entry: VocabEntry }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm + 4,
        backgroundColor: colors.bg,
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: radii.lg,
        paddingVertical: 12,
        paddingHorizontal: 14,
      }}
    >
      <Pressable
        // no clips are recorded yet, so this almost always speaks the lemma
        // with device TTS — passing it as fallback text is what makes it audible
        onPress={() => void playAudio(entry.audio, entry.lemma)}
        accessibilityRole="button"
        accessibilityLabel={`play audio for ${entry.lemma}`}
        style={{
          backgroundColor: colors.accent,
          borderRadius: radii.sm,
          paddingVertical: 8,
          paddingHorizontal: 12,
        }}
      >
        <Text style={{ fontSize: 16 }}>🔊</Text>
      </Pressable>
      {/* flex:1 so long translations wrap instead of pushing the row wide */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: font.sizeMd, fontWeight: "800", color: colors.text }}>
          {entry.lemma}
        </Text>
        <Text style={{ fontSize: font.sizeSm, color: colors.text, marginTop: 1 }}>
          {entry.translation}
        </Text>
        {entry.notes && (
          <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: 4 }}>
            {entry.notes}
          </Text>
        )}
      </View>
    </View>
  );
});
