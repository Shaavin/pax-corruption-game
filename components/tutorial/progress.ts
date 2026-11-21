"use client";

import { useSyncExternalStore } from "react";
import { LESSONS } from "@/lib/tutorial";

/** Lessons finished in this browser, and whether every lesson is open regardless. */
export type TutorialProgress = { done: string[]; unlockAll: boolean };

const KEY = "pax-tutorial-v1";
const EMPTY: TutorialProgress = { done: [], unlockAll: false };
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: TutorialProgress } | null = null;

function read(): TutorialProgress {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (cache && cache.raw === raw) return cache.value;
  let value = EMPTY;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<TutorialProgress>) : null;
    if (parsed) {
      value = {
        done: Array.isArray(parsed.done) ? parsed.done.filter((id): id is string => typeof id === "string") : [],
        unlockAll: parsed.unlockAll === true,
      };
    }
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

function write(value: TutorialProgress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Private mode: progress lasts until the tab closes (the cache still updates below).
    cache = { raw: null, value };
  }
  listeners.forEach((listener) => listener());
}

/** This browser's progress. Empty while rendering on the server. */
export function useTutorialProgress(): TutorialProgress {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read,
    () => EMPTY,
  );
}

export function markLessonDone(id: string) {
  const current = read();
  if (current.done.includes(id)) return;
  write({ ...current, done: [...current.done, id] });
}

export function setUnlockAll(unlockAll: boolean) {
  write({ ...read(), unlockAll });
}

/**
 * Lessons open in order: the first of each chapter's path once the one before it is done.
 * The expansion chapter opens after the base game's final exam.
 */
export function lessonUnlocked(progress: TutorialProgress, id: string): boolean {
  if (progress.unlockAll) return true;
  const index = LESSONS.findIndex((lesson) => lesson.id === id);
  if (index <= 0) return index === 0;
  return progress.done.includes(LESSONS[index - 1]!.id) || progress.done.includes(id);
}

/** The first lesson not yet done (the one to suggest), or null when all are done. */
export function nextUp(progress: TutorialProgress): string | null {
  return LESSONS.find((lesson) => !progress.done.includes(lesson.id))?.id ?? null;
}
