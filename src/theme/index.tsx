import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { kvGet, kvSet } from "@/lib/storage";
import { colors as lightColors, darkColors, font, radii, spacing, type Palette } from "./tokens";

export { spacing, radii, font, type Palette };

/**
 * Theming with dark mode. The monorepo app baked one palette into a static
 * StyleSheet at import time, which can't change at runtime — here styles are a
 * function of the palette and components read them through useTheme().
 *
 * "system" follows the OS; an explicit choice is remembered in SQLite.
 */
export type Scheme = "light" | "dark" | "system";

export function makeStyles(c: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bgMuted },
    container: { padding: spacing.md, gap: spacing.md },
    card: {
      backgroundColor: c.bg,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: radii.lg,
      padding: spacing.md,
    },
    title: { fontSize: font.sizeXl, fontWeight: "800", color: c.text },
    subtitle: { fontSize: font.sizeLg, fontWeight: "800", color: c.text },
    body: { fontSize: font.sizeMd, color: c.text },
    muted: { fontSize: font.sizeSm, color: c.textMuted },
    prompt: { fontSize: font.sizeLg, fontWeight: "700", color: c.text, marginBottom: spacing.md },
    btnPrimary: {
      // primaryFill is the only green ≥4.5:1 under this white label
      backgroundColor: c.primaryFill,
      borderRadius: radii.md,
      paddingVertical: 14,
      alignItems: "center",
      borderBottomWidth: 4,
      borderBottomColor: c.primaryDeep,
    },
    btnPrimaryDisabled: { backgroundColor: c.border, borderBottomColor: c.borderStrong },
    btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: font.sizeMd },
    btnGhost: {
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      alignItems: "center",
    },
    btnGhostText: { color: c.textMuted, fontWeight: "700" },
    optionBtn: {
      backgroundColor: c.bg,
      borderWidth: 2,
      borderBottomWidth: 4,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
    },
    optionSelected: { borderColor: c.accent, backgroundColor: c.accentSoft },
    optionText: { fontSize: font.sizeMd, fontWeight: "600", color: c.text },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  });
}

export type Styles = ReturnType<typeof makeStyles>;

interface ThemeValue {
  colors: Palette;
  styles: Styles;
  isDark: boolean;
  scheme: Scheme;
  setScheme: (s: Scheme) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const KEY = "theme.scheme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(); // "light" | "dark" | null
  const [scheme, setSchemeState] = useState<Scheme>(() => kvGet<Scheme>(KEY) ?? "system");

  const setScheme = (s: Scheme) => {
    setSchemeState(s);
    kvSet(KEY, s);
  };

  const isDark = scheme === "system" ? system === "dark" : scheme === "dark";

  const value = useMemo<ThemeValue>(() => {
    const colors: Palette = isDark ? darkColors : lightColors;
    return { colors, styles: makeStyles(colors), isDark, scheme, setScheme };
  }, [isDark, scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
