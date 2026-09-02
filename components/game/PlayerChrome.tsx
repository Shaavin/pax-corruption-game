"use client";

import { CardBack, CardView } from "./CardView";
import { resolveCard, type FixtureCard } from "./layout-fixture";
import {
  type ExecutiveSideId,
  type MonumentIdValue,
  type PartyIdValue,
} from "@/lib/cards/schema";

type PlayerChromeProps = {
  partyId: PartyIdValue;
  monuments: MonumentIdValue[];
  partisans: number;
  executive: ExecutiveSideId | null;
  policySupporters: number;
  office?: FixtureCard[];
  tourTarget?: "partisans";
};

export function PlayerChrome({
  partyId,
  monuments,
  partisans,
  executive,
  policySupporters,
  office = [],
  tourTarget,
}: PlayerChromeProps) {
  const party = resolveCard(partyId);
  const executiveCard = executive ? resolveCard(executive) : null;

  return (
    <div className="flex shrink-0 items-center gap-2 px-1">
      <CardView
        name={party.name}
        art={party.art}
        back={CardBack.party}
        size="mini"
      />
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
      {executiveCard ? (
        <CardView
          name={executiveCard.name}
          art={executiveCard.art}
          size="mini"
        />
      ) : null}
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
