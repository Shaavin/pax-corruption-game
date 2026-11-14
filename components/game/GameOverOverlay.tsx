"use client";

import Link from "next/link";
import { useState } from "react";
import { usePlayerLabel } from "./players";
import type { DistrictId } from "@/lib/cards/schema";
import { MILITARY_LEAD, POPULARITY_LEAD, VictoryKind, type Victory } from "@/lib/game";

const KIND_LABEL: Record<Victory["kind"], string> = {
  [VictoryKind.Military]: "Military Victory",
  [VictoryKind.Popularity]: "Popularity Victory",
  [VictoryKind.Ideological]: "Ideological Victory",
  [VictoryKind.Civil]: "Civil Victory",
  [VictoryKind.Political]: "Political Victory",
  [VictoryKind.Cultural]: "Cultural Victory",
  [VictoryKind.Diplomatic]: "Diplomatic Victory",
};

const DISTRICT_NAME: Record<DistrictId, string> = {
  dragonara: "Dragonara",
  horsard: "Horsard",
  shavvinne: "Shavvinne",
  smarbbit: "Smarbbit",
};

function victoryReason(victory: Victory): string {
  switch (victory.kind) {
    case VictoryKind.Military:
      return `Led by ${MILITARY_LEAD} or more partisans.`;
    case VictoryKind.Popularity:
      return `Led by ${POPULARITY_LEAD} or more support${victory.district ? ` in ${DISTRICT_NAME[victory.district]}` : ""}.`;
    case VictoryKind.Ideological:
      return `More ${victory.symbol ?? "ideology"} symbols, the ideology with the most total copies.`;
    case VictoryKind.Political:
      return "Met two active decree objectives at once.";
    case VictoryKind.Civil:
      return "Won the final election, or three elections with Roman Basilica.";
    case VictoryKind.Cultural:
      return "Had 2 or more monuments than the opponent.";
    case VictoryKind.Diplomatic:
      return "Had a higher relation than the opponent with 3 of the 4 World Powers.";
  }
}

export function GameOverOverlay({ victory, newGameHref = "/play" }: { victory: Victory; newGameHref?: string }) {
  const playerLabel = usePlayerLabel();
  const [reviewing, setReviewing] = useState(false);

  if (reviewing) {
    return (
      <button
        type="button"
        onClick={() => setReviewing(false)}
        className="absolute top-14 left-1/2 z-50 -translate-x-1/2 cursor-pointer rounded-full glass-strong px-4 py-1.5 text-xs font-semibold text-[var(--brass)] shadow-xl ring-1 ring-[var(--brass)]/50 hover:brightness-110"
      >
        ★ {playerLabel(victory.player)} won · {KIND_LABEL[victory.kind]} — show result
      </button>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
      <div
        role="dialog"
        aria-labelledby="game-over-title"
        className="pointer-events-auto max-w-md rounded-2xl glass-strong px-6 py-8 text-center shadow-2xl ring-1 ring-[var(--brass)]/40"
      >
        <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--brass)] uppercase">
          Game over
        </p>
        <h2 id="game-over-title" className="mt-2 text-3xl font-semibold text-stone-100">
          {playerLabel(victory.player)} wins
        </h2>
        <p className="mt-2 text-lg font-semibold text-[var(--brass)]">★ {KIND_LABEL[victory.kind]}</p>
        <p className="mt-1 text-sm text-stone-300">{victoryReason(victory)}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setReviewing(true)}
            className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-200 ring-1 ring-white/20 hover:bg-white/8"
          >
            Review the table
          </button>
          <a
            href={newGameHref}
            className="rounded-xl bg-[var(--act)] px-5 py-2.5 text-sm font-semibold text-stone-950 hover:brightness-110"
          >
            New game
          </a>
          <Link
            href="/"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-200 ring-1 ring-white/20 hover:bg-white/8"
          >
            Menu
          </Link>
        </div>
      </div>
    </div>
  );
}
