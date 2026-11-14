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

export type GameSummaryRow = {
  name: string;
  winner: boolean;
  districts: number;
  elections: number;
  partisans: number;
  monuments: number;
  support: number;
};

export function GameOverOverlay({
  victory,
  newGameHref = "/play",
  rematch,
  summary,
  onCopyRecord,
}: {
  victory: Victory;
  newGameHref?: string;
  /** Online: start or join a rematch (same settings and seats). */
  rematch?: { label: string; note?: string; onClick: () => void } | null;
  /** Final standings, one row per player. */
  summary?: GameSummaryRow[];
  /** Hotseat: copy the whole game as a share code (for replaying in the troubleshooter). */
  onCopyRecord?: () => Promise<boolean>;
}) {
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");
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
        {rematch?.note ? <p className="mt-3 text-sm font-semibold text-[var(--brass)]">{rematch.note}</p> : null}
        {summary && summary.length > 0 ? (
          <table className="mt-5 w-full text-xs">
            <caption className="sr-only">Final standings</caption>
            <thead>
              <tr className="text-[0.6rem] tracking-[0.1em] text-stone-400 uppercase">
                <th scope="col" className="pb-1 text-left font-semibold">Player</th>
                <th scope="col" className="pb-1 font-semibold" title="Districts each player led at the end">Districts</th>
                <th scope="col" className="pb-1 font-semibold">Elections</th>
                <th scope="col" className="pb-1 font-semibold">Partisans</th>
                <th scope="col" className="pb-1 font-semibold">Monuments</th>
                <th scope="col" className="pb-1 font-semibold" title="Cards in all support piles">Support</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {summary.map((row) => (
                <tr key={row.name} className={row.winner ? "font-semibold text-stone-50" : "text-stone-300"}>
                  <th scope="row" className="py-1 text-left font-semibold">
                    {row.winner ? "★ " : ""}
                    {row.name}
                  </th>
                  <td>{row.districts}/4</td>
                  <td>{row.elections}</td>
                  <td>{row.partisans}</td>
                  <td>{row.monuments}</td>
                  <td>{row.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setReviewing(true)}
            className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-200 ring-1 ring-white/20 hover:bg-white/8"
          >
            Review the table
          </button>
          {rematch ? (
            <button
              type="button"
              onClick={rematch.onClick}
              className="cursor-pointer rounded-xl bg-[var(--act)] px-5 py-2.5 text-sm font-semibold text-stone-950 hover:brightness-110"
            >
              {rematch.label}
            </button>
          ) : null}
          {onCopyRecord ? (
            <button
              type="button"
              onClick={async () => setCopied((await onCopyRecord()) ? "ok" : "failed")}
              title="A share code with every move, to replay this game on the troubleshooting page"
              className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-200 ring-1 ring-white/20 hover:bg-white/8"
            >
              {copied === "ok" ? "Copied" : copied === "failed" ? "Couldn't copy" : "Copy game record"}
            </button>
          ) : null}
          <a
            href={newGameHref}
            className={
              rematch
                ? "rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-200 ring-1 ring-white/20 hover:bg-white/8"
                : "rounded-xl bg-[var(--act)] px-5 py-2.5 text-sm font-semibold text-stone-950 hover:brightness-110"
            }
          >
            {rematch ? "New game" : "Play again"}
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
