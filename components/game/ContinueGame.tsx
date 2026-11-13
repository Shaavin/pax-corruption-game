"use client";

import { useMemo } from "react";
import { parseSavedGame, useSavedGameRaw } from "./saved-game";
import { GAME_MODES } from "@/lib/game/setup";

/** Menu button for the game saved in this browser, if one is still in progress. */
export function ContinueGame() {
  const raw = useSavedGameRaw();
  const saved = useMemo(() => (raw ? parseSavedGame(raw) : null), [raw]);
  if (!saved || saved.over) return null;
  return (
    <a
      href="/play?resume=1"
      className="rounded-full px-6 py-3 text-sm font-semibold tracking-wide text-stone-100 ring-1 ring-[var(--brass,#c6a56c)]/60 transition-colors hover:bg-white/8"
    >
      Continue game
      <span className="ml-2 text-xs font-normal text-stone-400 tabular-nums">
        {GAME_MODES.find((mode) => mode.id === (saved.record.mode ?? "standard"))?.name}
        {saved.record.expansion ? " + L&D" : ""} · Seed {saved.record.seed} ·{" "}
        {saved.record.actions.length} moves
      </span>
    </a>
  );
}
