"use client";

import Link from "next/link";
import { playerLabel } from "./players";
import { VictoryKind, type Victory } from "@/lib/game";

const KIND_LABEL: Record<Victory["kind"], string> = {
  [VictoryKind.Military]: "Military Victory",
  [VictoryKind.Popularity]: "Popularity Victory",
  [VictoryKind.Ideological]: "Ideological Victory",
};

export function GameOverOverlay({ victory }: { victory: Victory }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
      <div className="pointer-events-auto max-w-md rounded-xl bg-[#221c16] px-6 py-8 text-center shadow-2xl ring-1 ring-white/10">
        <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--brass)] uppercase">
          Game over
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-stone-100">
          {playerLabel(victory.player)} wins
        </h2>
        <p className="mt-2 text-sm text-stone-300">{KIND_LABEL[victory.kind]}</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-[var(--brass)] px-6 py-2.5 text-sm font-semibold text-stone-950 hover:bg-[#d4b57c]"
        >
          Back to menu
        </Link>
      </div>
    </div>
  );
}
