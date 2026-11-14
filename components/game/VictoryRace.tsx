"use client";

import { InfoTip } from "./InfoTip";
import type { RaceView } from "./table-model";
import type { VictoryStanding } from "@/lib/game/progress";
import type { VictoryKindId } from "@/lib/game/types";

const DISTRICT_NAME = { dragonara: "Dragonara", horsard: "Horsard", shavvinne: "Shavvinne", smarbbit: "Smarbbit" } as const;

const NAME: Record<VictoryKindId, string> = {
  civil: "Civil",
  political: "Political",
  military: "Military",
  popularity: "Popularity",
  ideological: "Ideological",
  cultural: "Cultural",
  diplomatic: "Diplomatic",
};

/** One line on how each victory is won. All but Civil are declared in your Politics step. */
function howToWin(kind: VictoryKindId, target: number): string {
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

/** "+4 / 9 Horsard", "1 / 2", "3 / 4 Chart"… */
function progressText(kind: VictoryKindId, standing: VictoryStanding): string {
  const signed = kind === "military" || kind === "popularity" || kind === "cultural";
  const value = signed && standing.value > 0 ? `+${standing.value}` : String(standing.value);
  const where =
    standing.district && standing.value > 0
      ? ` ${DISTRICT_NAME[standing.district]}`
      : standing.symbol
        ? ` ${standing.symbol[0]!.toUpperCase()}${standing.symbol.slice(1)}`
        : "";
  return `${value}/${standing.target}${where}`;
}

/** How close each player is to each victory: one step away turns amber, ready to declare glows. */
export function VictoryRace({ race }: { race: RaceView }) {
  const { civil } = race;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[0.7rem] leading-snug text-stone-300">
        <span className="font-semibold text-stone-100">Civil</span> · {civil.electionsLeft} election
        {civil.electionsLeft === 1 ? "" : "s"} left · if scored now:{" "}
        <span
          className="font-semibold"
          style={{ color: civil.projected === "you" ? "var(--you)" : civil.projected === "opponent" ? "var(--opp)" : undefined }}
        >
          {civil.projected === "you" ? "you win" : civil.projected === "opponent" ? "they win" : "—"}
        </span>
        {civil.basilica ? (
          <span className="block text-stone-400">
            Roman Basilica ({civil.basilica.who === "you" ? "yours" : "theirs"}): {civil.basilica.wins}/
            {civil.basilica.target} election wins to declare Civil early
          </span>
        ) : null}
      </p>
      <table className="w-full border-separate border-spacing-y-1 text-[0.65rem]">
        <thead>
          <tr className="text-[0.55rem] font-semibold tracking-[0.12em] uppercase">
            <th scope="col" className="sr-only">
              Victory
            </th>
            <th scope="col" className="px-1.5 text-left text-[var(--you)]">
              You
            </th>
            <th scope="col" className="px-1.5 text-left text-[var(--opp)]">
              Opponent
            </th>
          </tr>
        </thead>
        <tbody>
          {race.rows.map((row) => (
            <tr key={row.kind}>
              <th scope="row" className="w-[5.6rem] pr-1 text-left font-semibold whitespace-nowrap text-stone-200">
                <span className="inline-flex items-center gap-1">
                  {NAME[row.kind]}
                  <InfoTip label={`How to win ${NAME[row.kind]} Victory`}>
                    <b>{NAME[row.kind]} Victory.</b> {howToWin(row.kind, row.you.target)} Declare it in your Politics
                    step.
                    {row.active ? null : " Not active yet: a legacy event must activate it first."}
                  </InfoTip>
                </span>
              </th>
              {row.active ? (
                <>
                  <Cell kind={row.kind} standing={row.you} seat="you" who="You" />
                  <Cell kind={row.kind} standing={row.opponent} seat="opponent" who="Opponent" />
                </>
              ) : (
                <td colSpan={2} className="text-stone-500 italic">
                  Not active yet
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({
  kind,
  standing,
  seat,
  who,
}: {
  kind: VictoryKindId;
  standing: VictoryStanding;
  seat: "you" | "opponent";
  who: string;
}) {
  const color = seat === "you" ? "var(--you)" : "var(--opp)";
  const gap = standing.target - standing.value;
  const state = standing.met ? "met" : gap === 1 ? "close" : "far";
  const fill = Math.max(0, Math.min(1, standing.value / standing.target));
  // Ideological needs a symbol this player has more private copies of; without one there's nothing to count.
  const noSymbol = kind === "ideological" && !standing.symbol;
  return (
    <td className="w-1/2 px-0.5 align-middle">
      <div
        className={[
          "rounded-md px-1.5 py-1",
          state === "met"
            ? "bg-[var(--act)]/20 ring-1 ring-[var(--act)]"
            : state === "close"
              ? "bg-amber-400/10 ring-1 ring-amber-400/60"
              : "bg-white/[0.04]",
        ].join(" ")}
        title={`${who}: ${progressText(kind, standing)}${state === "met" ? " (can declare)" : state === "close" ? " (one step away)" : ""}`}
      >
        <div className="flex items-baseline justify-between gap-1 leading-none">
          <span className={noSymbol ? "truncate text-stone-500" : "truncate tabular-nums text-stone-100"}>
            {noSymbol ? "no symbol lead" : progressText(kind, standing)}
          </span>
          {state === "met" ? (
            <span className="shrink-0 text-[0.5rem] font-bold tracking-wide text-[var(--act)] uppercase">Win</span>
          ) : state === "close" ? (
            <span className="shrink-0 text-[0.5rem] font-bold tracking-wide text-amber-300 uppercase">1 away</span>
          ) : null}
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${fill * 100}%`, background: color }} />
        </div>
      </div>
    </td>
  );
}
