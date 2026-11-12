"use client";

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
  children,
}: PlayerBarProps) {
  const color = seat === "you" ? "var(--you)" : "var(--opp)";
  const party = partyId ? resolveCard(partyId) : null;

  return (
    <div className="flex min-w-0 items-center gap-3">
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
            <span className="text-sm font-semibold text-stone-100">{name}</span>
          </div>
          <div className="text-[0.6rem] tracking-wide text-stone-400">
            {party ? party.name : "Choosing a party"}
            {active ? (
              <span className="ml-1.5 font-semibold" style={{ color }}>
                · {seat === "you" ? "your turn" : "their turn"}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="flex shrink-0 items-center gap-3" data-tour={seat === "you" ? "partisans" : undefined}>
        <Stat label="Partisans" value={partisans} />
        <Stat label="Wins" value={electionWins} />
        <Stat label="Lords" value={lords} title="Council of Lords: alliance handshake symbols in play" />
        <Stat
          label="Leading"
          value={`${electorates}/5`}
          title="Electorates you'd win if the election were scored now"
          color={electorates >= 3 ? color : undefined}
        />
      </dl>

      {monuments.length + setAside.length > 0 ? (
        <div className="flex shrink-0 items-center gap-1">
          {monuments.map((id) => {
            const monument = resolveCard(id);
            return <CardView key={id} name={monument.name} art={monument.art} back={CardBack.monument} size="mini" cardId={id} />;
          })}
          {setAside.map((entry) => {
            const card = resolveCard(entry.cardId);
            return <CardView key={entry.instanceId} name={card.name} art={card.art} size="mini" cardId={entry.cardId} />;
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
  return (
    <div className="text-center leading-none" title={title}>
      <dt className="label !text-[0.5rem]">{label}</dt>
      <dd className="mt-1 text-base font-semibold tabular-nums text-stone-100" style={color ? { color } : undefined}>
        {value}
      </dd>
    </div>
  );
}
