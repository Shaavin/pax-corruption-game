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
  explain,
}: {
  label: string;
  you: number;
  opponent: number;
  /** The lead needed to win. */
  target: number;
  /** Expansion: off until a legacy event activates the victory. */
  active?: boolean;
  /** Tooltip and tap text, given the computed lead and state. */
  explain: (lead: number, state: TugState) => string;
}) {
  const notify = useNotice();
  const lead = you - opponent; // + toward you (right), − toward them (left)
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
        {opponent}
      </span>
      <div className="relative h-3 min-w-[2rem] flex-1">
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/12" />
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
        <span className="@max-[15rem]:hidden">You </span>
        {you}
      </span>
      {state === "off" ? <span className="text-stone-500 @max-[15rem]:hidden">off</span> : null}
      {state === "close" ? <span className="font-bold text-amber-300 uppercase">1 away</span> : null}
      {state === "met" ? <span className="font-bold text-[var(--act)] uppercase">Win ★</span> : null}
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

function Tick({ at, color, short = false }: { at: string; color: string; short?: boolean }) {
  return (
    <span
      aria-hidden
      className={["absolute top-1/2 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full", short ? "h-1.5" : "h-3"].join(" ")}
      style={{ left: at, background: color }}
    />
  );
}
