import { Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { refreshBundleIfNewer } from "@/content";
import { ProgressProvider } from "@/lib/progress";
import { ThemeProvider, useTheme } from "@/theme";

function Shell() {
  const { colors, isDark } = useTheme();

  // OFF-04: check for newer content in the background; never blocks play, and
  // quietly does nothing when there's no server to ask
  useEffect(() => {
    void refreshBundleIfNewer();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgMuted },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  // ThemeProvider wraps everything: Shell reads the palette via useTheme
  return (
    <ThemeProvider>
      <ProgressProvider>
        <Shell />
      </ProgressProvider>
    </ThemeProvider>
  );
}
