"use client";

import { CardBack, CardView } from "./CardView";
import { resolveCard, type FixtureCard } from "./layout-fixture";
import type { PartyIdValue } from "@/lib/cards/schema";

type PlayerChromeProps = {
  partyId: PartyIdValue | null;
  monuments: readonly string[];
  partisans: number;
  policySupporters: number;
  office?: FixtureCard[];
  tourTarget?: "partisans";
};

export function PlayerChrome({
  partyId,
  monuments,
  partisans,
  policySupporters,
  office = [],
  tourTarget,
}: PlayerChromeProps) {
  const party = partyId ? resolveCard(partyId) : null;

  return (
    <div className="flex shrink-0 items-center gap-2 px-1">
      {party ? (
        <CardView
          name={party.name}
          art={party.art}
          back={CardBack.party}
          size="mini"
          cardId={partyId ?? undefined}
        />
      ) : (
        <div
          aria-label="No party yet"
          className="flex aspect-[825/1125] w-[var(--card-mini)] items-center justify-center rounded-[0.22em] border border-dashed border-white/20 bg-black/20 text-center text-[0.45rem] font-semibold tracking-[0.12em] text-stone-500 uppercase"
        >
          Party
        </div>
      )}
      <div
        className="flex flex-col items-center gap-0.5"
        data-tour="supporters"
        title="Policy supporters tucked under the party. Count is public; identities stay hidden until a referendum."
      >
        <div className="relative">
          <CardView
            name={`${policySupporters} policy supporters`}
            art={CardBack.party}
            faceUp={false}
            back={CardBack.common}
            size="mini"
          />
          <span className="absolute -right-1 -bottom-1 rounded bg-stone-900 px-1 text-[0.65rem] font-semibold tabular-nums ring-1 ring-white/20">
            {policySupporters}
          </span>
        </div>
        <span className="text-[0.5rem] font-semibold tracking-[0.12em] text-stone-500 uppercase">
          Supporters
        </span>
      </div>
      {monuments.map((id) => {
        const monument = resolveCard(id);
        return (
          <CardView
            key={id}
            name={monument.name}
            art={monument.art}
            back={CardBack.monument}
            size="mini"
          />
        );
      })}
      {office.map((entry) => {
        const catalog = resolveCard(entry.cardId);
        return (
          <CardView
            key={entry.instanceId}
            name={catalog.name}
            art={catalog.art}
            size="mini"
          />
        );
      })}
      <div
        className="min-w-[2.4rem] text-center leading-tight"
        data-tour={tourTarget}
      >
        <div className="text-[0.55rem] font-semibold tracking-[0.14em] text-stone-400 uppercase">
          Partisans
        </div>
        <div className="text-lg font-semibold tabular-nums text-stone-100">
          {partisans}
        </div>
      </div>
    </div>
  );
}
