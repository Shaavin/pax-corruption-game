"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DistrictHub } from "./DistrictHub";
import { Hand } from "./Hand";
import { LAYOUT_FIXTURE } from "./layout-fixture";
import { Market } from "./Market";
import { PeekContext, type PeekCard } from "./peek";
import { PlayerChrome } from "./PlayerChrome";
import { Tableau } from "./Tableau";
import { TableTour } from "./TableTour";
import { ZoomPreview } from "./ZoomPreview";
import type { DistrictId } from "@/lib/cards/schema";

const LANE_TINT: Record<DistrictId, string> = {
  dragonara: "bg-[var(--dragonara)]/12",
  horsard: "bg-[var(--horsard)]/12",
  shavvinne: "bg-[var(--shavvinne)]/12",
  smarbbit: "bg-[var(--smarbbit)]/12",
};

export function Table() {
  const [peek, setPeek] = useState<PeekCard | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const fixture = LAYOUT_FIXTURE;
  const setPeekSafe = useCallback(
    (card: PeekCard | null) => {
      if (!tourOpen) setPeek(card);
    },
    [tourOpen],
  );

  return (
    <PeekContext.Provider value={{ setPeek: setPeekSafe }}>
      <div className="table-felt flex h-dvh w-full flex-col overflow-hidden text-stone-100">
        <header className="flex shrink-0 items-center justify-between px-3 py-1 text-[0.65rem] text-stone-500">
          <Link
            href="/"
            className="tracking-[0.14em] uppercase hover:text-stone-300"
          >
            Pax Corruption
          </Link>
          <div className="flex items-center gap-3">
            <TableTour
              onVisibilityChange={(open) => {
                setTourOpen(open);
                if (open) setPeek(null);
              }}
            />
            <span className="uppercase">
              General election {fixture.electionsOut}/4
            </span>
            <span>Layout fixture · no rules</span>
          </div>
        </header>

        <div className="hand-rail hand-rail-opponent flex shrink-0 items-center gap-3 px-3 py-2">
          <span className="w-16 shrink-0 text-[0.6rem] font-semibold tracking-[0.16em] text-stone-500 uppercase">
            Opponent
          </span>
          <Hand cards={fixture.opponent.hand} faceUp={false} align="start" />
          <PlayerChrome
            partyId={fixture.opponent.partyId}
            monuments={fixture.opponent.monuments}
            partisans={fixture.opponent.partisans}
            executive={fixture.opponent.executive}
            policySupporters={fixture.opponent.policySupporters}
            office={fixture.opponent.office}
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-4">
          {fixture.districtOrder.map((district) => (
            <div
              key={`opp-${district}`}
              className={`min-h-0 border-x border-white/6 ${LANE_TINT[district]}`}
            >
              <Tableau
                cards={fixture.opponent.tableau[district]}
                anchor="top"
              />
            </div>
          ))}
        </div>

        <div className="grid shrink-0 grid-cols-4">
          {fixture.districtOrder.map((district) => (
            <div
              key={`hub-${district}`}
              className={`border-x border-white/6 ${LANE_TINT[district]}`}
            >
              <DistrictHub
                district={district}
                policyId={fixture.policies[district]}
                yourSupport={fixture.you.support[district]}
                theirSupport={fixture.opponent.support[district]}
              />
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-4">
          {fixture.districtOrder.map((district) => (
            <div
              key={`you-${district}`}
              className={`min-h-0 border-x border-white/6 ${LANE_TINT[district]}`}
            >
              <Tableau
                cards={fixture.you.tableau[district]}
                anchor="bottom"
                tourId={district === "dragonara" ? "your-tableau" : undefined}
              />
            </div>
          ))}
        </div>

        <Market
          market={fixture.market}
          monuments={fixture.availableMonuments}
          deckCount={fixture.deckCount}
        />

        <div className="hand-rail hand-rail-you flex shrink-0 items-center gap-3 px-3 py-2">
          <span className="w-16 shrink-0 text-[0.6rem] font-semibold tracking-[0.16em] text-[var(--brass)] uppercase">
            You
          </span>
          <Hand cards={fixture.you.hand} faceUp align="end" tourId="your-hand" />
          <PlayerChrome
            partyId={fixture.you.partyId}
            monuments={fixture.you.monuments}
            partisans={fixture.you.partisans}
            executive={fixture.you.executive}
            policySupporters={fixture.you.policySupporters}
            office={fixture.you.office}
            tourTarget="partisans"
          />
        </div>

        {tourOpen ? null : <ZoomPreview card={peek} />}
      </div>
    </PeekContext.Provider>
  );
}
