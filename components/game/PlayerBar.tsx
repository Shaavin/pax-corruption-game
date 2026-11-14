"use client";

import { useNotice } from "./notice";
import type { ReactNode } from "react";
import { CardBack, CardView } from "./CardView";
import { resolveCard, type FixtureCard } from "./layout-fixture";
import type { PartyIdValue } from "@/lib/cards/schema";

type PlayerBarProps = {
  seat: "you" | "opponent";
  name: string;
  partyId: PartyIdValue | null;
  monuments: readonly string[];
  setAside: FixtureCard[];
  partisans: number;
  electionWins: number;
  /** Electorates this player would win if the election were scored now (of 5). */
  electorates: number;
  /** Council of Lords handshake symbols in play. */
  lords: number;
  active: boolean;
  /** Phone layout: tighter spacing, smaller labels. */
  compact?: boolean;
  /** Phone layout: the opponent's hand as a count instead of fanned backs. */
  handCount?: number;
  children?: ReactNode;
};

/** Portrait strip for one seat: party, monuments, and the numbers that win games. */
export function PlayerBar({
  seat,
  name,
  partyId,
  monuments,
  setAside,
  partisans,
  electionWins,
  electorates,
  lords,
  active,
  compact = false,
  handCount,
  children,
}: PlayerBarProps) {
  const color = seat === "you" ? "var(--you)" : "var(--opp)";
  const party = partyId ? resolveCard(partyId) : null;

  return (
    <div className={["flex min-w-0 items-center", compact ? "w-max gap-2.5" : "gap-3"].join(" ")}>
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative">
          {party ? (
            <CardView name={party.name} art={party.art} back={CardBack.party} size="mini" cardId={partyId ?? undefined} />
          ) : (
            <div className="flex aspect-[825/1125] w-[var(--card-mini)] items-center justify-center rounded-[0.32em] border border-dashed border-white/15 text-[0.45rem] text-stone-500 uppercase">
              Party
            </div>
          )}
          {active ? (
            <span
              className="absolute -inset-1 -z-10 rounded-lg opacity-70 blur-[6px]"
              style={{ background: color }}
              aria-hidden
            />
          ) : null}
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
            <span className={["font-semibold whitespace-nowrap text-stone-100", compact ? "text-xs" : "text-sm"].join(" ")}>
              {name}
            </span>
          </div>
          <div className="text-[0.6rem] tracking-wide whitespace-nowrap text-stone-400">
            {party ? party.name : "Choosing a party"}
            {active ? (
              <span className="ml-1.5 font-semibold" style={{ color }}>
                · {seat === "you" ? "your turn" : "their turn"}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <dl
        className={["flex shrink-0 items-center", compact ? "gap-2" : "gap-3"].join(" ")}
        data-tour={seat === "you" ? "partisans" : undefined}
      >
        {handCount !== undefined ? <Stat label="Hand" value={handCount} title="Hand: cards in their hand." /> : null}
        <Stat
          label="Partisans"
          value={partisans}
          title="Partisans: how many times this player has recruited. A lead of 3 wins Military Victory."
        />
        <Stat label="Wins" value={electionWins} title="Wins: elections won so far." />
        <Stat
          label="Lords"
          value={lords}
          title="Lords: alliance handshake symbols in play. More than the other player wins the Council of Lords, the 5th electorate."
        />
        <Stat
          label={compact ? "Elect." : "Electorates"}
          value={`${electorates}/5`}
          title="Electorates: how many of the 5 (4 districts + Council of Lords) this player would win if the election were scored now."
          color={electorates >= 3 ? color : undefined}
        />
      </dl>

      {monuments.length + setAside.length > 0 ? (
        <div className="flex shrink-0 items-center gap-1">
          {monuments.map((id) => {
            const monument = resolveCard(id);
            return (
              <CardView
                key={id}
                name={monument.name}
                art={monument.art}
                back={CardBack.monument}
                size="mini"
                cardId={id}
                motionKey={`monument:${id}`}
              />
            );
          })}
          {setAside.map((entry) => {
            const card = resolveCard(entry.cardId);
            return (
              <CardView
                key={entry.instanceId}
                name={card.name}
                art={card.art}
                size="mini"
                cardId={entry.cardId}
                motionKey={entry.instanceId}
              />
            );
          })}
        </div>
      ) : null}

      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  title,
  color,
}: {
  label: string;
  value: number | string;
  title?: string;
  color?: string;
}) {
  const notify = useNotice();
  // Tapping a number explains it (touch screens have no hover tooltips).
  return (
    <div
      className={["text-center leading-none", title ? "cursor-help" : ""].join(" ")}
      title={title}
      onClick={title ? () => notify(title) : undefined}
    >
      <dt className="label !text-[0.5rem]">{label}</dt>
      <dd className="mt-1 text-base font-semibold tabular-nums text-stone-100" style={color ? { color } : undefined}>
        {value}
      </dd>
    </div>
  );
}
