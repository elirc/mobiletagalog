# Aral Tagalog — standalone mobile app

A Duolingo-style app teaching **Tagalog to English speakers**, built with React Native + Expo.
Ported from the `tagalog` monorepo into a single self-contained project: no pnpm workspace, no
`@aral/*` packages, no build step needed before `expo start`.

```bash
npm install
npm start          # then press "a" for Android, "i" for iOS, or scan the QR in Expo Go
```

## It works with no backend

The compiled course ships inside the app (`src/content/bundle.json` — 15 units, 57 lessons, 480
exercises, 230 vocabulary entries). Play as a guest and everything works offline on first launch:
progress lives in SQLite on the device.

The API is **optional**, and only adds two things: syncing progress across devices (log in /
register) and pulling newer content than the shipped bundle. Point it somewhere real by editing
`extra.apiUrl` in `app.json`; leave it and the app simply stays local — every network path fails
soft.

## Audio

No clips are recorded yet, so every 🔊 falls back to the device's text-to-speech voice
(`expo-speech`, `fil-PH`, slowed to 0.85 for learners). The bundle carries the spoken text for each
audio ref, so this covers all 304 of them. Real recordings win automatically once they exist —
`playAudio` tries the cached file, then the network, then speech.

## Layout

```
app/                     expo-router screens
  _layout.tsx            ThemeProvider > ProgressProvider > Stack
  index.tsx              course map — continue hero, collapsible units, grammar tips
  lesson/[lessonId].tsx  lesson route (unlock + practice gating)
  stats.tsx              XP, level, streak, goal editor, 14-day chart, achievements, appearance
  words.tsx              phrasebook — all 230 words, searchable, with audio
  login.tsx register.tsx
src/
  core/                  game logic, vendored from @aral/core (pure TS, no platform deps)
  content/               bundle.json + lookup/refresh helpers
  theme/                 tokens (light + dark palettes) and ThemeProvider/useTheme
  lib/                   storage (SQLite), api, progress (event-sourced), audio, ads
  components/            Header, LessonPlayer, AudioScreen, exercise views
```

## Notes on the port

- **Game logic is unchanged.** `src/core` is a verbatim copy of the monorepo's `@aral/core`
  (its imports are all relative, so it vendors cleanly). Keep it that way: if the rule for hearts,
  streaks, XP or grading needs to change, change it there and keep the two in sync.
- **Progress is event-sourced.** Clients append `ProgressEvent`s with UUID ids; `/sync` is the only
  write path; `reduceEvents` derives state on both sides. Don't add state-mutation endpoints.
- **Theming is dynamic.** The monorepo app baked one palette into a static `StyleSheet.create` at
  import time, which can't respond to a theme switch. Here `makeStyles(palette)` is called per
  theme and components read `colors`/`styles` from `useTheme()`. A module-scope colour import or a
  hard-coded hex will silently break dark mode.
- **No `metro.config.js`.** The monorepo needed one to watch the workspace root and resolve hoisted
  dependencies; standalone, Expo's defaults are correct.
- Content itself is authored in the monorepo (`packages/content`), which compiles the YAML into the
  bundle. To take new content, recompile there and copy `dist/course_en_tl.json` over
  `src/content/bundle.json`.

## Source-based improvement course

[Start the course](astraupskill/README.md). Trace session generations, acknowledged event batches, and baseline/outbox transaction boundaries.
