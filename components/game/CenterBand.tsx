"use client";

import type { ReactNode } from "react";
import { useNotice } from "./notice";
import type { SymbolsView } from "./table-model";
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
  ideological,
  symbols,
  seats,
}: {
  military: { you?: SeatVictory; opponent?: SeatVictory };
  partisans: { you: number; opponent: number };
  ideological: { you?: SeatVictory; opponent?: SeatVictory };
  symbols: SymbolsView | null;
  /** Which seat is "you": the symbol tooltip names players in seat order. */
  seats: { you: PlayerId; opponent: PlayerId };
}) {
  if (!military.you || !military.opponent || !symbols) return null;
  return (
    <div className="relative z-20 mx-1.5 my-1 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-black/60 px-2.5 py-1 text-[0.62rem] leading-none text-stone-300 ring-1 ring-white/10 backdrop-blur-sm">
      <TugOfWar you={military.you} opponent={military.opponent} partisans={partisans} />
      <SymbolTally symbols={symbols} active={ideological.you?.active ?? true} seats={seats} />
    </div>
  );
}

// --- Military: tug-of-war --------------------------------------------------------------------

function TugOfWar({
  you,
  opponent,
  partisans,
}: {
  you: SeatVictory;
  opponent: SeatVictory;
  partisans: { you: number; opponent: number };
}) {
  const notify = useNotice();
  const target = you.standing.target;
  const lead = partisans.you - partisans.opponent; // + toward you (right), − toward them (left)
  const leader = lead > 0 ? you : lead < 0 ? opponent : null;
  const gap = leader ? target - Math.abs(lead) : target;
  const state = !you.active ? "off" : leader?.standing.met ? "met" : gap === 1 ? "close" : "far";
  // Track spans one past the win line on each side.
  const span = target + 1;
  const pct = (value: number) => `${((Math.max(-span, Math.min(span, value)) + span) / (2 * span)) * 100}%`;
  const markerColor =
    state === "met" ? "var(--act)" : lead > 0 ? "var(--you)" : lead < 0 ? "var(--opp)" : "rgb(214 211 209)";
  const explain = `Military Victory. ${howToWin("military", target)} Partisans: you ${partisans.you}, opponent ${partisans.opponent}${
    lead === 0 ? " (even)" : ` (${lead > 0 ? "you" : "they"} lead by ${Math.abs(lead)})`
  }.${state === "off" ? " Not active yet: a legacy event must activate it first." : state === "met" ? " Can be declared in Politics." : state === "close" ? " One step away." : ""}`;

  return (
    <div
      className={["flex min-w-[12rem] flex-1 cursor-help items-center gap-2", state === "off" ? "opacity-50" : ""].join(" ")}
      title={explain}
      role="img"
      aria-label={explain}
      onClick={() => notify(explain)}
    >
      <span className="font-semibold tracking-[0.12em] text-stone-200 uppercase">Military</span>
      <span className="tabular-nums" style={{ color: "var(--opp)" }}>
        Opp {partisans.opponent}
      </span>
      <div className="relative h-3 min-w-[5rem] flex-1">
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/12" />
        {/* Win lines at the target lead on each side, and the center. */}
        <Tick at={pct(-target)} color="var(--opp)" />
        <Tick at={pct(0)} color="rgb(255 255 255 / 0.35)" short />
        <Tick at={pct(target)} color="var(--you)" />
        <span
          className={[
            "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/60 transition-[left] duration-500",
            state === "met" ? "shadow-[0_0_10px_var(--act)]" : state === "close" ? "shadow-[0_0_8px_rgb(251_191_36)]" : "",
          ].join(" ")}
          style={{ left: pct(lead), background: markerColor }}
        />
      </div>
      <span className="tabular-nums" style={{ color: "var(--you)" }}>
        You {partisans.you}
      </span>
      {state === "off" ? <span className="text-stone-500">off</span> : null}
      {state === "close" ? <span className="font-bold text-amber-300 uppercase">1 away</span> : null}
      {state === "met" ? <span className="font-bold text-[var(--act)] uppercase">Win ★</span> : null}
    </div>
  );
}

function Tick({ at, color, short = false }: { at: string; color: string; short?: boolean }) {
  return (
    <span
      aria-hidden
      className={["absolute top-1/2 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full", short ? "h-1.5" : "h-3"].join(" ")}
      style={{ left: at, background: color }}
    />
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
