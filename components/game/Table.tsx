"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { DistrictHub } from "./DistrictHub";
import { ExecutiveSlot } from "./ExecutiveSlot";
import { Hand } from "./Hand";
import { Market } from "./Market";
import { PeekContext, type PeekCard } from "./peek";
import { PlayerChrome } from "./PlayerChrome";
import { Tableau } from "./Tableau";
import { TableTour } from "./TableTour";
import { ZoomPreview } from "./ZoomPreview";
import { playerLabel } from "./players";
import type { TableModel } from "./table-model";
import type { DistrictId } from "@/lib/cards/schema";
import { districtInfluence } from "@/lib/game/influence";
import { otherPlayer, type PlayerId } from "@/lib/game";

const LANE_TINT: Record<DistrictId, string> = {
  dragonara: "bg-[var(--dragonara)]/12",
  horsard: "bg-[var(--horsard)]/12",
  shavvinne: "bg-[var(--shavvinne)]/12",
  smarbbit: "bg-[var(--smarbbit)]/12",
};

export type TableInteraction = {
  playableHandIds: ReadonlySet<string>;
  selectedHandId: string | null;
  onSelectHand: (instanceId: string) => void;
  targetDistrict: DistrictId | null;
  onSelectDistrict: (district: DistrictId) => void;
  takeableMarketIds: ReadonlySet<string>;
  onTakeMarket: (instanceId: string) => void;
  prompt: string;
  extraAction?: { label: string; onClick: () => void };
};

type TableProps = {
  model: TableModel;
  seed: number;
  status: string;
  showTour: boolean;
  veiled: boolean;
  hotseat: PlayerId;
  interaction?: TableInteraction | null;
  children?: ReactNode;
};

export function Table({
  model,
  seed,
  status,
  showTour,
  veiled,
  hotseat,
  interaction,
  children,
}: TableProps) {
  const [peek, setPeek] = useState<PeekCard | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const opponent = otherPlayer(hotseat);
  if (veiled && peek !== null) {
    setPeek(null);
  }
  const setPeekSafe = useCallback(
    (card: PeekCard | null) => {
      if (!tourOpen && !veiled) setPeek(card);
    },
    [tourOpen, veiled],
  );

  return (
    <PeekContext.Provider value={{ setPeek: setPeekSafe }}>
      <div className="table-felt relative flex h-dvh w-full flex-col overflow-hidden text-stone-100">
        <header className="flex shrink-0 items-center justify-between px-3 py-1 text-[0.65rem] text-stone-500">
          <Link
            href="/"
            className="tracking-[0.14em] uppercase hover:text-stone-300"
          >
            Pax Corruption
          </Link>
          <div className="flex items-center gap-3">
            {showTour ? (
              <TableTour
                allowAutoOpen={showTour}
                onVisibilityChange={(open) => {
                  setTourOpen(open);
                  if (open) setPeek(null);
                }}
              />
            ) : null}
            <span
              className="rounded-full bg-[var(--brass)]/15 px-2.5 py-0.5 text-[0.65rem] font-semibold tracking-[0.14em] text-[var(--brass)] uppercase"
              title="The player currently using this device"
            >
              {playerLabel(hotseat)} · hot seat
            </span>
            <span className="uppercase">
              General election {model.electionsOut}/4
            </span>
            <span className="tabular-nums" title="Deterministic setup seed">
              Seed {seed}
            </span>
            <span>{status}</span>
          </div>
        </header>

        <div className="hand-rail hand-rail-opponent flex shrink-0 items-center gap-3 px-3 py-2">
          <span className="w-[4.4rem] shrink-0 leading-tight">
            <span className="block text-[0.6rem] font-semibold tracking-[0.16em] text-stone-500 uppercase">
              Opponent
            </span>
            <span className="block text-[0.55rem] tracking-[0.12em] text-stone-400 uppercase">
              {playerLabel(opponent)}
            </span>
          </span>
          <Hand cards={model.opponent.hand} faceUp align="start" />
          <ExecutiveSlot side={model.opponent.executive} align="start" />
          <PlayerChrome
            partyId={model.opponent.partyId}
            monuments={model.opponent.monuments}
            partisans={model.opponent.partisans}
            policySupporters={model.opponent.policySupporters}
            office={model.opponent.office}
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-4">
          {model.districtOrder.map((district) => (
            <div
              key={`opp-${district}`}
              className={`min-h-0 border-x border-white/6 ${LANE_TINT[district]}`}
            >
              <Tableau cards={model.opponent.tableau[district]} anchor="top" />
            </div>
          ))}
        </div>

        <div className="grid shrink-0 grid-cols-4">
          {model.districtOrder.map((district) => (
            <div
              key={`hub-${district}`}
              className={`border-x border-white/6 ${LANE_TINT[district]}`}
            >
              <DistrictHub
                district={district}
                policyId={model.policies[district]}
                yourSupport={model.you.support[district]}
                theirSupport={model.opponent.support[district]}
                yourInfluence={districtInfluence(
                  model.you.tableau[district],
                  model.you.support[district],
                )}
                theirInfluence={districtInfluence(
                  model.opponent.tableau[district],
                  model.opponent.support[district],
                )}
              />
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-4">
          {model.districtOrder.map((district) => (
            <div
              key={`you-${district}`}
              className={[
                "relative min-h-0 border-x border-white/6",
                LANE_TINT[district],
                interaction?.targetDistrict === district
                  ? "ring-2 ring-inset ring-[var(--brass)]"
                  : "",
              ].join(" ")}
            >
              {interaction?.targetDistrict === district ? (
                <button
                  type="button"
                  className="absolute inset-0 z-20 cursor-pointer bg-[var(--brass)]/10"
                  aria-label={`Play into ${district}`}
                  onClick={() => interaction.onSelectDistrict(district)}
                >
                  <span className="pointer-events-none absolute inset-x-1 bottom-1 rounded-sm bg-black/55 px-1 py-0.5 text-center text-[0.55rem] font-semibold tracking-[0.14em] text-[var(--brass)] uppercase">
                    Play here
                  </span>
                </button>
              ) : null}
              <Tableau
                cards={model.you.tableau[district]}
                anchor="bottom"
                tourId={district === model.districtOrder[0] ? "your-tableau" : undefined}
              />
            </div>
          ))}
        </div>

        <Market
          market={model.market}
          monuments={model.availableMonuments}
          deckCount={model.deckCount}
          takeableIds={interaction?.takeableMarketIds}
          onTake={interaction?.onTakeMarket}
        />

        {interaction ? (
          <div className="flex shrink-0 items-center justify-center gap-3 px-3 py-1">
            <p className="text-center text-[0.7rem] tracking-wide text-stone-300">
              {interaction.prompt}
            </p>
            {interaction.extraAction ? (
              <button
                type="button"
                className="cursor-pointer rounded-full bg-[var(--brass)] px-3 py-1 text-[0.7rem] font-semibold text-stone-950 hover:bg-[#d4b57c]"
                onClick={interaction.extraAction.onClick}
              >
                {interaction.extraAction.label}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="hand-rail hand-rail-you flex shrink-0 items-center gap-3 px-3 py-2">
          <span className="w-[4.4rem] shrink-0 leading-tight">
            <span className="block text-[0.6rem] font-semibold tracking-[0.16em] text-[var(--brass)] uppercase">
              You
            </span>
            <span className="block text-[0.55rem] tracking-[0.12em] text-[var(--brass)] uppercase">
              {playerLabel(hotseat)}
            </span>
          </span>
          <Hand
            cards={model.you.hand}
            faceUp
            align="end"
            tourId="your-hand"
            playableIds={interaction?.playableHandIds}
            selectedId={interaction?.selectedHandId}
            onSelect={interaction?.onSelectHand}
          />
          <ExecutiveSlot side={model.you.executive} align="end" />
          <PlayerChrome
            partyId={model.you.partyId}
            monuments={model.you.monuments}
            partisans={model.you.partisans}
            policySupporters={model.you.policySupporters}
            office={model.you.office}
            tourTarget="partisans"
          />
        </div>

        {children}
        {tourOpen || veiled ? null : <ZoomPreview card={peek} />}
      </div>
    </PeekContext.Provider>
  );
}
