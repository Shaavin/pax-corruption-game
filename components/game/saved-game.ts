"use client";

import { useSyncExternalStore } from "react";
import { parseRecord, toRecord, type GameRecord, type Replay } from "@/lib/game/record";
import { APP_BUILD } from "./share";

/** The one in-progress hotseat game, kept in this browser so a reload can resume it. */
export const SAVE_KEY = "pax-hotseat-game-v1";

export type SavedGame = {
  record: GameRecord;
  over: boolean;
  savedAt: number;
};

const listeners = new Set<() => void>();

export function saveGame(replay: Replay): void {
  writeSave(toSaved(replay));
}

/** Save an arbitrary record (troubleshooting: "play on from here"). */
export function saveRecord(record: GameRecord, over = false): void {
  writeSave({ record, over, savedAt: Date.now() });
}

function toSaved(replay: Replay): SavedGame {
  return { record: toRecord(replay, APP_BUILD), over: Boolean(replay.state.victory), savedAt: Date.now() };
}

function writeSave(saved: SavedGame): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch {
    // Storage blocked or full: the game still plays, it just won't resume after a reload.
  }
  for (const listener of listeners) listener();
}

export function parseSavedGame(raw: string | null): SavedGame | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SavedGame>;
    const record = parseRecord(value.record);
    if (!record) return null;
    return { record, over: Boolean(value.over), savedAt: Number(value.savedAt) || 0 };
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SAVE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The saved game's raw JSON. `undefined` while rendering on the server or
 * hydrating (storage is unknown), `null` when nothing is saved.
 */
export function useSavedGameRaw(): string | null | undefined {
  return useSyncExternalStore(subscribe, readRaw, () => undefined);
}
