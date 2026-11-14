"use client";

import { createContext, useCallback, useContext } from "react";
import { NO_NAMES, playerName, type PlayerNames } from "@/lib/game/names";
import type { PlayerId } from "@/lib/game/types";

/** The current game's player names (each seat's chosen name, or none). */
export const PlayerNamesContext = createContext<PlayerNames>(NO_NAMES);

export function usePlayerNames(): PlayerNames {
  return useContext(PlayerNamesContext);
}

/** Label a seat: its name, or "Player 1" / "Player 2". */
export function usePlayerLabel(): (player: PlayerId) => string {
  const names = useContext(PlayerNamesContext);
  return useCallback((player: PlayerId) => playerName(names, player), [names]);
}

/** Outside React (or with names in hand). */
export function playerLabel(player: PlayerId, names?: PlayerNames): string {
  return playerName(names, player);
}

const NAMES_KEY = "pax-player-names";

/** The names last typed on this device, to prefill the next game. */
export function rememberedNames(): PlayerNames {
  try {
    const raw = JSON.parse(localStorage.getItem(NAMES_KEY) ?? "null") as unknown;
    return Array.isArray(raw) ? [typeof raw[0] === "string" ? raw[0] : null, typeof raw[1] === "string" ? raw[1] : null] : NO_NAMES;
  } catch {
    return NO_NAMES;
  }
}

export function rememberNames(names: PlayerNames): void {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(names));
  } catch {
    // Not remembered: fine.
  }
}
