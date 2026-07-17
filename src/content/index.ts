import type { CourseBundle, Lesson } from "@/core";
import { api } from "@/lib/api";
import { kvGet, kvSet } from "@/lib/storage";
import bundleJson from "./bundle.json";

/**
 * The compiled course ships inside the app binary, so every lesson works on
 * first launch with no network and no server (OFF-01). A newer bundle pulled
 * from the API later wins.
 */
const shippedBundle = bundleJson as unknown as CourseBundle;

let active: CourseBundle = kvGet<CourseBundle>("bundle") ?? shippedBundle;
// a shipped app update can carry newer content than the cached download
if (active.version < shippedBundle.version) active = shippedBundle;

export function getBundle(): CourseBundle {
  return active;
}

/**
 * OFF-04: on launch (online) compare versions and swap in a newer bundle in
 * the background. Never blocks play; a missing/unreachable API is fine.
 */
export async function refreshBundleIfNewer(): Promise<boolean> {
  try {
    const manifest = await api.manifest();
    if (manifest.version <= active.version) return false;
    const fresh = (await api.bundle(manifest.bundle)) as CourseBundle;
    kvSet("bundle", fresh);
    active = fresh;
    return true;
  } catch {
    return false; // offline or no server — keep playing the shipped bundle
  }
}

export function findLesson(lessonId: string): { lesson: Lesson; unitTitle: string } | null {
  for (const unit of active.units) {
    const lesson = unit.lessons.find((l) => l.id === lessonId);
    if (lesson) return { lesson, unitTitle: unit.title };
  }
  return null;
}

/** Lessons unlock in order: everything up to the first uncompleted lesson. */
export function isLessonUnlocked(lessonId: string, completed: string[]): boolean {
  const done = new Set(completed);
  for (const unit of active.units) {
    for (const lesson of unit.lessons) {
      if (lesson.id === lessonId) return true;
      if (!done.has(lesson.id)) return false;
    }
  }
  return false;
}
