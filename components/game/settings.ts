"use client";

import { useSyncExternalStore } from "react";

/** Per-device display preferences. */
export type Settings = {
  /** Hotseat: replay the other player's moves after the device is handed over. */
  replay: boolean;
  /** Card movement animations. */
  motion: "off" | "normal" | "fast";
};

const KEY = "pax-settings-v1";
const DEFAULTS: Settings = { replay: true, motion: "normal" };
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: Settings = DEFAULTS;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Current settings (outside React too, e.g. the card-motion layer). */
export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  const raw = readRaw();
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const value = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    cached = {
      replay: typeof value.replay === "boolean" ? value.replay : DEFAULTS.replay,
      motion: value.motion === "off" || value.motion === "fast" || value.motion === "normal" ? value.motion : DEFAULTS.motion,
    };
  } catch {
    cached = DEFAULTS;
  }
  return cached;
}

export function updateSettings(change: Partial<Settings>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getSettings(), ...change }));
  } catch {
    // Not saved: this session only.
    cached = { ...getSettings(), ...change };
  }
  listeners.forEach((listener) => listener());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSettings,
    () => DEFAULTS,
  );
}

/** Animation time multiplier for the current setting (0 = no animation). */
export function motionScale(): number {
  const { motion } = getSettings();
  return motion === "off" ? 0 : motion === "fast" ? 0.55 : 1;
}
