"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ContinueHint, CountdownBar, LEAVE_MS, readingMs, useScale } from "./moment-kit";
import { usePlayerLabel } from "./players";
import { ElectionTieBreak, GENERAL_ELECTION_COUNT, otherPlayer, type ElectionTieBreakId, type PlayerId } from "@/lib/game";

/** One of the five electorates, and who won it. */
export type Seat = { id: string; label: string; color: string; winner: PlayerId | null };

/** An election opens (TableMoment.tsx queues it on `electionStarted`). */
export type ElectionStartData = {
  id: number;
  kind: "electionStart";
  /** General Election cards revealed so far, this election's included. */
  revealed: number;
  /** General Elections in this election (each one owes its winner a decree). */
  count: number;
  final: boolean;
  expansion: boolean;
};

/** An election is counted (`electionTallied`). */
export type ElectionResultData = {
  id: number;
  kind: "electionResult";
  winner: PlayerId;
  electorates: [number, number];
  electors: [number, number];
  tieBreak: ElectionTieBreakId;
  /** In table order, Lords last. Null when the tally didn't name them (an older online server). */
  seats: Seat[] | null;
  /** Decrees the winner activates next. */
  decrees: number;
  /** The game ended with Civil Victory for this player. */
  civil: PlayerId | null;
  final: boolean;
};

/** The polls open: a ribbon sweeps across the table and the General Election card flips in. */
export function ElectionStart({ moment, onDone }: { moment: ElectionStartData; onDone: () => void }) {
  const scale = useScale();
  const [leaving, setLeaving] = useState(false);

  const first = moment.revealed - moment.count + 1;
  const eyebrow = moment.final
    ? "The final General Election"
    : moment.count > 1
      ? `General Elections ${first}–${moment.revealed} of ${GENERAL_ELECTION_COUNT}`
      : `General Election ${moment.revealed} of ${GENERAL_ELECTION_COUNT}`;
  const market = moment.expansion
    ? "The Market opens a second row and won't refill. When its last non-event card is taken, the votes are counted."
    : "The Market grows to 8 cards and won't refill. When it runs dry, the votes are counted.";
  const stakes = moment.final
    ? " The winner takes Civil Victory."
    : moment.count > 1
      ? ` The winner activates up to ${moment.count} decrees.`
      : "";
  const TITLE = "The polls are open";
  // Reading starts as the title comes in.
  const readFrom = 300 * scale;
  const hold = readingMs(eyebrow, TITLE, market, stakes);

  useEffect(() => {
    const leave = window.setTimeout(() => setLeaving(true), readFrom + hold);
    const done = window.setTimeout(onDone, readFrom + hold + LEAVE_MS * scale);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, [onDone, scale, readFrom, hold]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-election-moment="start"
      data-modal
      onClick={onDone}
      className="fixed inset-0 z-[70] flex cursor-pointer items-center"
      style={{ "--moment-scale": scale } as CSSProperties}
    >
      <div aria-hidden className={["election-veil absolute inset-0", leaving ? "is-leaving" : ""].join(" ")} />
      <div className={["election-ribbon relative w-full overflow-hidden", leaving ? "is-leaving" : ""].join(" ")}>
        <div aria-hidden className="election-sheen" />
        <div className="relative mx-auto flex max-w-4xl items-center gap-4 px-5 py-5 sm:gap-7 sm:px-8 sm:py-7">
          {/* eslint-disable-next-line @next/next/no-img-element -- the card face, already in the cache */}
          <img
            src="/cards/deck/election.png"
            alt=""
            draggable={false}
            className="election-card w-16 shrink-0 rounded-md shadow-[0_10px_30px_rgb(0_0_0/0.6)] ring-1 ring-white/20 sm:w-28"
          />
          <div className="min-w-0 text-left">
            <p className="election-line text-[0.65rem] font-semibold tracking-[0.2em] text-[var(--election)] uppercase sm:text-xs">
              {eyebrow}
            </p>
            <h2 className="election-title mt-1 text-3xl leading-tight font-semibold text-white sm:text-5xl">{TITLE}</h2>
            <p className="election-line election-line-late mt-2 max-w-xl text-xs leading-relaxed text-stone-300 sm:text-sm">
              {market}
              {stakes}
            </p>
            <ContinueHint delayMs={readFrom} className="mt-2.5" />
          </div>
        </div>
        <CountdownBar delayMs={readFrom} durationMs={hold} inset="inset-x-0" />
      </div>
    </div>
  );
}

const FIRST_SEAT_MS = 700;
const SEAT_MS = 420;

/** The votes are counted: each electorate lights up in its winner's color, then the winner is stamped. */
export function ElectionResult({ moment, viewer, onDone }: { moment: ElectionResultData; viewer: PlayerId; onDone: () => void }) {
  const label = usePlayerLabel();
  const scale = useScale();
  const seats = moment.seats;
  const [shown, setShown] = useState(0);
  const [stamped, setStamped] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const opponent = otherPlayer(viewer);
  const color = (player: PlayerId | null) => (player === null ? "rgb(168 162 158)" : player === viewer ? "var(--you)" : "var(--opp)");
  const score = (player: PlayerId) =>
    stamped || !seats ? moment.electorates[player] : seats.slice(0, shown).filter((seat) => seat.winner === player).length;
  const winner = moment.winner;
  const loser = otherPlayer(winner);
  const headline = winner === viewer ? "You win the election" : `${label(winner)} wins the election`;

  const tieLine =
    moment.tieBreak === ElectionTieBreak.Electors
      ? `Electorates tied ${moment.electorates[winner]}–${moment.electorates[loser]}. More electors in the electorates won: ${moment.electors[winner]} to ${moment.electors[loser]}.`
      : moment.tieBreak === ElectionTieBreak.Incumbent
        ? "Electorates and electors tied: the incumbent stays in power."
        : moment.tieBreak === ElectionTieBreak.FirstPlayer
          ? "Electorates and electors tied: the first player wins the first election."
          : null;
  const next =
    moment.civil !== null
      ? `${moment.civil === viewer ? "You take" : `${label(moment.civil)} takes`} Civil Victory.`
      : moment.decrees > 0
        ? `${winner === viewer ? "You activate" : `${label(winner)} activates`} ${moment.decrees === 1 ? "a decree" : `${moment.decrees} decrees`} next.`
        : null;

  // The electorates are read as they're counted; the verdict gets its own reading time.
  const count = seats?.length ?? 0;
  const stampAt = (FIRST_SEAT_MS + count * SEAT_MS + 250) * scale;
  const readFrom = stampAt + 300 * scale;
  const hold = readingMs("Elected", headline, tieLine, next);

  useEffect(() => {
    const timers: number[] = [];
    for (let index = 1; index <= count; index++) {
      timers.push(window.setTimeout(() => setShown(index), (FIRST_SEAT_MS + (index - 1) * SEAT_MS) * scale));
    }
    timers.push(window.setTimeout(() => setStamped(true), stampAt));
    timers.push(window.setTimeout(() => setLeaving(true), readFrom + hold));
    timers.push(window.setTimeout(onDone, readFrom + hold + LEAVE_MS * scale));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [count, scale, stampAt, readFrom, hold, onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${headline}, ${moment.electorates[winner]} electorates to ${moment.electorates[loser]}.`}
      data-election-moment="result"
      data-modal
      onClick={onDone}
      className="fixed inset-0 z-[70] flex cursor-pointer items-center justify-center px-4"
      style={{ "--moment-scale": scale } as CSSProperties}
    >
      <div aria-hidden className={["election-veil absolute inset-0", leaving ? "is-leaving" : ""].join(" ")} />
      <div
        className={[
          "election-panel relative w-full max-w-xl rounded-2xl glass-strong px-4 py-5 text-center shadow-2xl ring-1 ring-[var(--election)]/35 sm:px-6 sm:py-6",
          leaving ? "is-leaving" : "",
        ].join(" ")}
      >
        <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-[var(--election)] uppercase sm:text-xs">
          {moment.final ? "The final election" : "The votes are in"}
        </p>

        <div className="mt-3 flex items-center justify-center gap-4 sm:gap-6">
          <ScoreSide name="You" value={score(viewer)} color={color(viewer)} />
          <span className="text-2xl text-stone-500">–</span>
          <ScoreSide name={label(opponent)} value={score(opponent)} color={color(opponent)} />
        </div>
        <p className="mt-1 text-[0.65rem] tracking-wide text-stone-500 uppercase">electorates won</p>

        {seats ? (
          <ul className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2.5">
            {seats.map((seat, index) => {
              const counted = index < shown;
              return (
                <li
                  key={seat.id}
                  className={["election-seat flex flex-col items-center gap-1 rounded-lg px-1 pt-1.5 pb-2", counted ? "is-counted" : ""].join(" ")}
                  style={{ "--winner": color(seat.winner) } as CSSProperties}
                >
                  <span aria-hidden className="h-1 w-6 rounded-full" style={{ background: seat.color }} />
                  <span className="max-w-full truncate text-[0.62rem] font-semibold text-stone-200 sm:text-xs">{seat.label}</span>
                  <span
                    className="text-[0.6rem] font-semibold tracking-wide uppercase sm:text-[0.65rem]"
                    style={{ color: counted ? color(seat.winner) : "rgb(120 113 108)" }}
                  >
                    {!counted ? "· · ·" : seat.winner === null ? "Nobody" : seat.winner === viewer ? "You" : "Opponent"}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="mt-5 flex min-h-[8rem] flex-col items-center justify-start">
          {stamped ? (
            <>
              <span
                className="election-stamp inline-block rounded-md border-[3px] px-3 py-0.5 text-sm font-black tracking-[0.3em] uppercase sm:text-base"
                style={{ color: color(winner), borderColor: color(winner) }}
              >
                Elected
              </span>
              <h2 className="election-headline mt-3 text-2xl font-semibold text-stone-50 sm:text-3xl">{headline}</h2>
              {tieLine ? <p className="election-headline mt-1.5 max-w-md text-xs text-stone-400 sm:text-sm">{tieLine}</p> : null}
              {next ? <p className="election-headline mt-1.5 text-sm font-semibold text-[var(--act)]">{next}</p> : null}
              {/* Its delay counts from when the verdict is stamped (it mounts then). */}
              <ContinueHint delayMs={300 * scale} className="mt-3" />
            </>
          ) : null}
        </div>
        {stamped ? <CountdownBar delayMs={300 * scale} durationMs={hold} inset="inset-x-4" /> : null}
      </div>
    </div>
  );
}

function ScoreSide({ name, value, color }: { name: string; value: number; color: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <span key={value} className="election-score text-4xl leading-none font-semibold tabular-nums sm:text-5xl" style={{ color }}>
        {value}
      </span>
      <span className="mt-1 max-w-[9rem] truncate text-xs text-stone-300">{name}</span>
    </div>
  );
}
