"use client";

import type { RaceView } from "./table-model";
import type { VictoryStanding } from "@/lib/game/progress";
import type { VictoryKindId } from "@/lib/game/types";
import type { ExpansionVictoryId } from "@/lib/cards/expansion";

/** The band color printed on each Legacy Victory card (sampled from its face). */
export const LEGACY_VICTORY_COLOR: Record<ExpansionVictoryId, string> = {
  military: "#b51700",
  ideological: "#004d80",
  popularity: "#a34d01",
  cultural: "#b21465",
  diplomatic: "#006a00",
};

/**
 * Shared helpers for victory progress shown on the table, next to what each victory
 * measures: Military, Ideological, and Political on the center band; Popularity on the
 * district plates; Cultural in Monuments; Diplomatic in World; Civil on the elections band.
 */

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
