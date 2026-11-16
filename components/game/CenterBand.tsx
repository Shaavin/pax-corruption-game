"use client";

import type { ReactNode } from "react";
import { useNotice } from "./notice";
import type { SymbolsView } from "./table-model";
import { TugBar, tugStateText } from "./TugBar";
import { howToWin, type SeatVictory } from "./victory-marks";
import { SYMBOLS, type SymbolId } from "@/lib/cards/schema";
import type { PlayerId } from "@/lib/game/types";
import { usePlayerLabel } from "./players";

/**
 * The band across the middle of the districts, just above the plates: Military Victory
 * as a tug-of-war between the two players' partisans, and Ideological Victory as a tally
 * of the four symbols. Both are player-wide, so they sit across all four districts.
 */
export function CenterBand({
  military,
  partisans,
  political,
  ideological,
  symbols,
  seats,
}: {
  military: { you?: SeatVictory; opponent?: SeatVictory };
  partisans: { you: number; opponent: number };
  /** Political Victory: active decrees each player meets (2 to win). */
  political: { you?: SeatVictory; opponent?: SeatVictory };
  ideological: { you?: SeatVictory; opponent?: SeatVictory };
  symbols: SymbolsView | null;
  /** Which seat is "you": the symbol tooltip names players in seat order. */
  seats: { you: PlayerId; opponent: PlayerId };
}) {
  if (!military.you || !military.opponent || !symbols) return null;
  return (
    // Three player-wide victories share the row equally (and wrap on narrow screens).
    <div className="relative z-20 mx-1.5 my-1 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-[0.62rem] leading-none text-stone-300 ring-1 ring-white/10 backdrop-blur-sm">
      <div className="min-w-[13rem] flex-1">
        <TugOfWar you={military.you} opponent={military.opponent} partisans={partisans} />
      </div>
      <div className="flex min-w-fit flex-1 justify-center border-white/10 sm:border-x sm:px-3">
        <SymbolTally symbols={symbols} active={ideological.you?.active ?? true} seats={seats} />
      </div>
      <div className="flex min-w-fit flex-1 justify-center">
        {political.you && political.opponent ? <PoliticalPips you={political.you} opponent={political.opponent} /> : null}
      </div>
    </div>
  );
}

// --- Military: tug-of-war --------------------------------------------------------------------

function TugOfWar({
  you,
  partisans,
}: {
  you: SeatVictory;
  opponent: SeatVictory;
  partisans: { you: number; opponent: number };
}) {
  const target = you.standing.target;
  return (
    <div>
      <TugBar
        label="Military"
        you={partisans.you}
        opponent={partisans.opponent}
        target={target}
        active={you.active}
        explain={(lead, state) =>
          `Military Victory. ${howToWin("military", target)} Partisans: you ${partisans.you}, opponent ${partisans.opponent}${
            lead === 0 ? " (even)" : ` (${lead > 0 ? "you" : "they"} lead by ${Math.abs(lead)})`
          }.${tugStateText(state)}`
        }
      />
    </div>
  );
}

// --- Political: decrees met ------------------------------------------------------------------

/** Political Victory: each player's active decrees met, as pips out of the 2 needed. */
function PoliticalPips({ you, opponent }: { you: SeatVictory; opponent: SeatVictory }) {
  const notify = useNotice();
  const target = you.standing.target;
  const explain = `Political Victory. ${howToWin("political", target)} Decrees met: you ${you.standing.value}, opponent ${opponent.standing.value} (of ${target}).${
    you.standing.met || opponent.standing.met
      ? " Can be declared in Politics."
      : you.standing.value === target - 1 || opponent.standing.value === target - 1
        ? " One step away."
        : ""
  }`;
  const seat = (victory: SeatVictory, color: string, label: string) => {
    const state = victory.standing.met ? "met" : victory.standing.value === target - 1 ? "close" : "far";
    return (
      <span className="flex items-center gap-1" style={{ color }}>
        {label}
        <span className="flex gap-0.5" aria-hidden>
          {Array.from({ length: target }, (_, index) => (
            <span
              key={index}
              className={[
                "h-2 w-2 rounded-full border-[1.5px]",
                state === "met" ? "shadow-[0_0_8px_var(--act)]" : state === "close" ? "shadow-[0_0_6px_rgb(251_191_36)]" : "",
              ].join(" ")}
              style={{
                borderColor: color,
                background: index < victory.standing.value ? (state === "met" ? "var(--act)" : color) : "transparent",
              }}
            />
          ))}
        </span>
      </span>
    );
  };
  const met = you.standing.met || opponent.standing.met;
  const close = !met && (you.standing.value === target - 1 || opponent.standing.value === target - 1);
  return (
    <div className="flex cursor-help items-center gap-2" title={explain} role="img" aria-label={explain} onClick={() => notify(explain)}>
      <span className="font-semibold tracking-[0.12em] text-stone-200 uppercase">Political</span>
      {seat(opponent, "var(--opp)", "Opp")}
      {seat(you, "var(--you)", "You")}
      {close ? <span className="font-bold text-amber-300 uppercase">1 away</span> : null}
      {met ? <span className="font-bold text-[var(--act)] uppercase">Win ★</span> : null}
    </div>
  );
}

// --- Ideological: symbol tally ----------------------------------------------------------------

const SYMBOL_NAME: Record<SymbolId, string> = { atom: "Science", chart: "Economy", crown: "Authority", scales: "Justice" };
const IDEOLOGICAL_COUNT = 4;

/** "copy" for 1, "copies" otherwise. */
const copyWord = (count: number) => (count === 1 ? "copy" : "copies");

function SymbolTally({
  symbols,
  active,
  seats,
}: {
  symbols: SymbolsView;
  active: boolean;
  seats: { you: PlayerId; opponent: PlayerId };
}) {
  const notify = useNotice();
  const playerLabel = usePlayerLabel();
  // Ideological's total: public copies + the larger player's private copies. The color shows who has more
  // private copies (who's dominating the symbol); ties own nothing.
  const rows = SYMBOLS.map((symbol) => {
    const you = symbols.you[symbol];
    const opponent = symbols.opponent[symbol];
    const owner: "you" | "opponent" | null = you > opponent ? "you" : opponent > you ? "opponent" : null;
    return { symbol, you, opponent, shared: symbols.shared[symbol], owner, total: symbols.shared[symbol] + Math.max(you, opponent) };
  });
  const withNeed = rows.map((row) => {
    const others = Math.max(...rows.filter((other) => other.symbol !== row.symbol).map((other) => other.total));
    const need = Math.max(IDEOLOGICAL_COUNT, others + 1);
    const state = !active || !row.owner ? "far" : row.total >= need ? "met" : need - row.total === 1 ? "close" : "far";
    return { ...row, need, state };
  });
  const intro = `Ideological Victory. ${howToWin("ideological", IDEOLOGICAL_COUNT)}${
    active ? "" : " Not active yet: a legacy event must activate it first."
  }`;

  return (
    <div className={["flex items-center gap-2", active ? "" : "opacity-50"].join(" ")}>
      <span
        className="cursor-help font-semibold tracking-[0.12em] text-stone-200 uppercase"
        title={intro}
        onClick={() => notify(intro)}
      >
        Ideology
      </span>
      {withNeed.map((row) => {
        const color = row.owner === "you" ? "var(--you)" : row.owner === "opponent" ? "var(--opp)" : "rgb(168 162 158)";
        // Players in seat order (Player 1 first).
        const [first, second] = ([0, 1] as const).map((seat) => ({
          name: playerLabel(seat),
          count: seat === seats.you ? row.you : row.opponent,
        }));
        const explain = [
          `${SYMBOL_NAME[row.symbol]}: ${row.total} total ${copyWord(row.total)}.`,
          `${row.shared} public ${copyWord(row.shared)}. (+${row.shared})`,
          `${first!.count} private ${copyWord(first!.count)} from ${first!.name}, and ${second!.count} private ${copyWord(second!.count)} from ${second!.name}. (+${Math.max(row.you, row.opponent)})`,
        ].join("\n");
        return (
          <span
            key={row.symbol}
            title={explain}
            aria-label={explain}
            role="note"
            onClick={() => notify(explain)}
            className={[
              "inline-flex cursor-help items-center gap-1 rounded px-1 py-0.5 tabular-nums",
              row.state === "met"
                ? "bg-[var(--act)]/25 ring-1 ring-[var(--act)]"
                : row.state === "close"
                  ? "bg-amber-400/15 ring-1 ring-amber-400/60"
                  : "",
            ].join(" ")}
            style={{ color }}
          >
            <SymbolIcon symbol={row.symbol} />
            <span className="font-semibold">{row.total}</span>
          </span>
        );
      })}
      {active ? null : <span className="text-stone-500">off</span>}
    </div>
  );
}

/** Small line icons for the four ideological symbols. */
function SymbolIcon({ symbol }: { symbol: SymbolId }) {
  const paths: Record<SymbolId, ReactNode> = {
    atom: (
      <>
        <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
        <ellipse cx="8" cy="8" rx="6.5" ry="2.6" />
        <ellipse cx="8" cy="8" rx="6.5" ry="2.6" transform="rotate(60 8 8)" />
        <ellipse cx="8" cy="8" rx="6.5" ry="2.6" transform="rotate(120 8 8)" />
      </>
    ),
    chart: (
      <>
        <path d="M2 14h12" />
        <path d="M3 11l3.5-3.5 2.5 2.5L14 4" />
        <path d="M10.5 4H14v3.5" />
      </>
    ),
    crown: <path d="M2.5 12.5h11L14 5l-3.5 3L8 3.5 5.5 8 2 5l.5 7.5z" />,
    scales: (
      <>
        <path d="M8 2.5v11M5 13.5h6M3 5h10" />
        <path d="M3 5l-2 4.5h4L3 5zM13 5l-2 4.5h4L13 5z" />
      </>
    ),
  };
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
      {paths[symbol]}
    </svg>
  );
}
