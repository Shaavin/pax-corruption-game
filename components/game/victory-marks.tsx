"use client";

import { useNotice } from "./notice";
import type { RaceView } from "./table-model";
import type { VictoryStanding } from "@/lib/game/progress";
import type { VictoryKindId } from "@/lib/game/types";

/**
 * Victory progress shown on the table, next to what each victory measures (partisans,
 * symbols, monuments, relations on the player bars; Popularity on district plates;
 * Political on the decrees; Civil on the elections band). One look everywhere: plain
 * progress, amber one step away, gold when it can be declared, "off" until activated.
 */

export const VICTORY_NAME: Record<VictoryKindId, string> = {
  civil: "Civil",
  political: "Political",
  military: "Military",
  popularity: "Popularity",
  ideological: "Ideological",
  cultural: "Cultural",
  diplomatic: "Diplomatic",
};

/** One line on how each victory is won. All but Civil are declared in your Politics step. */
export function howToWin(kind: VictoryKindId, target: number): string {
  switch (kind) {
    case "political":
      return `Meet ${target} active decrees at the same time.`;
    case "military":
      return `Recruit ${target} more partisans than your opponent.`;
    case "popularity":
      return `Have ${target} more cards than your opponent in one district's support pile.`;
    case "ideological":
      return "Have the most copies of one symbol (at least 4), with more private copies of it than your opponent. Shared copies (policies, active decrees) count for both.";
    case "cultural":
      return `Have ${target} more monuments than your opponent.`;
    case "diplomatic":
      return `Have a higher relation than your opponent with ${target} of the 4 World Powers.`;
    default:
      return "Win the final election: the one in which the last General Election is revealed.";
  }
}

/** One seat's standing toward one victory. */
export type SeatVictory = { kind: VictoryKindId; active: boolean; standing: VictoryStanding };

/** Every victory's standing for one seat, keyed by kind (empty during setup). */
export function seatVictories(
  race: RaceView | null,
  seat: "you" | "opponent",
): Partial<Record<VictoryKindId, SeatVictory>> {
  if (!race) return {};
  return Object.fromEntries(
    race.rows.map((row) => [row.kind, { kind: row.kind, active: row.active, standing: row[seat] }]),
  );
}

type MarkState = "off" | "none" | "far" | "close" | "met";

function markState(victory: SeatVictory): MarkState {
  if (!victory.active) return "off";
  // Ideological needs a symbol this player has more private copies of; without one there's nothing to count.
  if (victory.kind === "ideological" && !victory.standing.symbol) return "none";
  if (victory.standing.met) return "met";
  return victory.standing.target - victory.standing.value === 1 ? "close" : "far";
}

/** "+4/9", "1/2", "3/4"… Leads are signed. */
export function progressText(kind: VictoryKindId, standing: VictoryStanding): string {
  const signed = kind === "military" || kind === "popularity" || kind === "cultural";
  const value = signed && standing.value > 0 ? `+${standing.value}` : String(standing.value);
  return `${value}/${standing.target}`;
}

const STYLE: Record<MarkState, string> = {
  off: "text-stone-500 ring-1 ring-white/10",
  none: "bg-white/[0.04] text-stone-500",
  far: "bg-white/[0.06] text-stone-300",
  close: "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/60",
  met: "bg-[var(--act)]/25 text-[var(--act)] ring-1 ring-[var(--act)] shadow-[0_0_10px_rgb(245_199_107/0.45)]",
};

/** A small progress pill for one seat's victory; tap or hover explains it. */
export function VictoryMark({ victory, who }: { victory: SeatVictory; who: "You" | "Opponent" }) {
  const notify = useNotice();
  const state = markState(victory);
  const name = VICTORY_NAME[victory.kind];
  const text = state === "off" ? "off" : state === "none" ? "–" : progressText(victory.kind, victory.standing);
  const status =
    state === "off"
      ? "Not active yet: a legacy event must activate it first."
      : state === "met"
        ? "Can be declared in Politics."
        : state === "close"
          ? "One step away."
          : `Now ${text}.`;
  const explain = `${who} · ${name} Victory. ${howToWin(victory.kind, victory.standing.target)} ${status}`;
  return (
    <span
      role="note"
      aria-label={explain}
      title={explain}
      onClick={(event) => {
        event.stopPropagation();
        notify(explain);
      }}
      className={[
        "inline-flex cursor-help items-center gap-0.5 rounded px-1 py-px text-[0.6rem] leading-none font-semibold whitespace-nowrap tabular-nums",
        STYLE[state],
      ].join(" ")}
    >
      {text}
      {state === "met" ? <span aria-hidden>★</span> : null}
    </span>
  );
}
