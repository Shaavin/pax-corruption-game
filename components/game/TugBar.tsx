"use client";

import { useNotice } from "./notice";

/**
 * A lead-based victory as a tug-of-war (Popularity, Cultural): label, the opponent's count,
 * a track with win lines at the needed lead on each side, your count, and a state badge.
 * The marker sits at your lead (right) or theirs (left); amber one step away, gold when won.
 * Narrow lanes (`@max-[15rem]` container) drop the "Opp"/"You" words.
 */
export function TugBar({
  label,
  you,
  opponent,
  target,
  active = true,
  voided = false,
  explain,
}: {
  label: string;
  you: number;
  opponent: number;
  /** The lead needed to win. */
  target: number;
  /** Expansion: off until a legacy event activates the victory. */
  active?: boolean;
  /**
   * Both counts are cancelled (West "support remains at zero"): the counts are struck
   * through, a lock replaces the marker, and the lead is 0. The `explain` text should say why.
   */
  voided?: boolean;
  /** Tooltip and tap text, given the computed lead and state. */
  explain: (lead: number, state: TugState) => string;
}) {
  const notify = useNotice();
  const lead = voided ? 0 : you - opponent; // + toward you (right), − toward them (left)
  const gap = target - Math.abs(lead);
  const state: TugState = !active ? "off" : lead !== 0 && gap <= 0 ? "met" : lead !== 0 && gap === 1 ? "close" : "far";
  const span = target + 1;
  const pct = (value: number) => `${((Math.max(-span, Math.min(span, value)) + span) / (2 * span)) * 100}%`;
  const markerColor =
    state === "met" ? "var(--act)" : lead > 0 ? "var(--you)" : lead < 0 ? "var(--opp)" : "rgb(214 211 209)";
  const text = explain(lead, state);
  return (
    <div
      className={[
        "flex cursor-help items-center gap-1.5 text-[0.62rem] leading-none text-stone-300 @max-[15rem]:gap-1 @max-[15rem]:text-[0.55rem]",
        state === "off" ? "opacity-50" : "",
      ].join(" ")}
      title={text}
      role="img"
      aria-label={text}
      onClick={() => notify(text)}
    >
      <span className="font-semibold tracking-[0.12em] text-stone-200 uppercase @max-[15rem]:tracking-normal" aria-hidden>
        {label}
      </span>
      <span className="tabular-nums" style={{ color: "var(--opp)" }}>
        <span className="@max-[15rem]:hidden">Opp </span>
        <Count value={opponent} voided={voided} />
      </span>
      <div className="relative h-3 min-w-[2rem] flex-1 @max-[6rem]:min-w-[1.25rem]">
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/12" />
        <Tick at={pct(-target)} color="var(--opp)" />
        <Tick at={pct(0)} color="rgb(255 255 255 / 0.35)" short />
        <Tick at={pct(target)} color="var(--you)" />
        {voided ? (
          // Locked: a lock over the middle of the track instead of the marker (there is no lead to show).
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-stone-950 text-[var(--ember)] ring-1 ring-[var(--ember)]/60"
          >
            <LockIcon />
          </span>
        ) : (
          <span
            className={[
              "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/60 transition-[left] duration-500",
              state === "met" ? "shadow-[0_0_10px_var(--act)]" : state === "close" ? "shadow-[0_0_8px_rgb(251_191_36)]" : "",
            ].join(" ")}
            style={{ left: pct(lead), background: markerColor }}
          />
        )}
      </div>
      <span className="tabular-nums" style={{ color: "var(--you)" }}>
        <span className="@max-[15rem]:hidden">You </span>
        <Count value={you} voided={voided} />
      </span>
      {voided ? <span className="font-bold text-[var(--ember)] uppercase">×0</span> : null}
      {state === "off" && !voided ? <span className="text-stone-500 @max-[15rem]:hidden">off</span> : null}
      {state === "close" && !voided ? <span className="font-bold text-amber-300 uppercase">1 away</span> : null}
      {state === "met" && !voided ? <span className="font-bold text-[var(--act)] uppercase">Win ★</span> : null}
    </div>
  );
}

export type TugState = "off" | "far" | "close" | "met";

/** Shared tail for the explanations: what the state means. */
export function tugStateText(state: TugState): string {
  return state === "off"
    ? " Not active yet: a legacy event must activate it first."
    : state === "met"
      ? " Can be declared in Politics."
      : state === "close"
        ? " One step away."
        : "";
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="currentColor">
      <path d="M8 1.5a3.25 3.25 0 0 0-3.25 3.25V6.5H4a1.25 1.25 0 0 0-1.25 1.25v5.5A1.25 1.25 0 0 0 4 14.5h8a1.25 1.25 0 0 0 1.25-1.25v-5.5A1.25 1.25 0 0 0 12 6.5h-.75V4.75A3.25 3.25 0 0 0 8 1.5Zm-1.75 5V4.75a1.75 1.75 0 0 1 3.5 0V6.5h-3.5Z" />
    </svg>
  );
}

/** A count, struck through when it is cancelled. */
function Count({ value, voided }: { value: number; voided: boolean }) {
  return voided ? (
    <s className="decoration-[var(--ember)] decoration-2 opacity-70">{value}</s>
  ) : (
    <>{value}</>
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
