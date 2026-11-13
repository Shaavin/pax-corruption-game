"use client";

import { useMemo } from "react";
import { parseSavedGame, useSavedGameRaw } from "./saved-game";
import { GAME_MODES } from "@/lib/game/setup";

/** Home-page card for the game saved in this browser, if one is still in progress. */
export function ContinueGame() {
  const raw = useSavedGameRaw();
  const saved = useMemo(() => (raw ? parseSavedGame(raw) : null), [raw]);
  if (!saved || saved.over) return null;
  const mode = GAME_MODES.find((entry) => entry.id === (saved.record.mode ?? "standard"))?.name;
  return (
    <a
      href="/play?resume=1"
      className="group mb-5 flex items-center justify-between gap-4 rounded-2xl border border-[var(--you)]/30 bg-[var(--you)]/[0.07] px-4 py-3 transition hover:border-[var(--you)]/60 hover:bg-[var(--you)]/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--you)]"
    >
      <span>
        <span className="block text-sm font-semibold text-stone-100">Continue your game</span>
        <span className="block text-xs text-stone-400 tabular-nums">
          {mode}
          {saved.record.expansion ? " + Legacy & Diplomacy" : ""} · {saved.record.actions.length} moves
        </span>
      </span>
      <span aria-hidden className="text-lg text-[var(--you)] transition group-hover:translate-x-0.5">
        →
      </span>
    </a>
  );
}
