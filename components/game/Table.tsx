"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { Hand } from "./Hand";
import { HistoryRail } from "./HistoryRail";
import { Lane } from "./Lane";
import { PeekContext, type PeekCard } from "./peek";
import { PlayerAid } from "./PlayerAid";
import { PlayerBar } from "./PlayerBar";
import { playerLabel } from "./players";
import { SidePanel, TurnDock, type DockBanner, type ExtraAction } from "./SidePanel";
import type { TableModel } from "./table-model";
import { TableTour } from "./TableTour";
import { ZoomPreview } from "./ZoomPreview";
import type { DistrictId } from "@/lib/cards/schema";
import type { GameEvent, PlayerId } from "@/lib/game";

export type { DockBanner, ExtraAction };

export type TableInteraction = {
  playableHandIds: ReadonlySet<string>;
  selectableHandIds?: ReadonlySet<string>;
  selectedHandIds: ReadonlySet<string>;
  onSelectHand: (instanceId: string) => void;
  targetDistrict: DistrictId | null;
  targetLabel: string;
  onSelectDistrict: (district: DistrictId) => void;
  takeableMarketIds: ReadonlySet<string>;
  marketMode?: "take" | "use";
  onTakeMarket: (instanceId: string) => void;
  claimableMonumentIds: ReadonlySet<string>;
  onClaimMonument: (instanceId: string) => void;
  /** A card is selected to seat in the Senate: mark the Senator who will leave. */
  seatArmed?: boolean;
  /** Victory prompt above the turn controls. */
  banner?: DockBanner | null;
  /** Propose Policy: Senators the current reveal convinces, and its vote total. */
  convincedSenators?: ReadonlySet<number>;
  revealVotes?: number | null;
  prompt: string;
  extraActions: ExtraAction[];
};

type TableProps = {
  model: TableModel;
  seed: number;
  showTour: boolean;
  veiled: boolean;
  hotseat: PlayerId;
  history: readonly GameEvent[];
  /** Shown in the turn dock when it isn't this seat's move (setup, waiting, game over). */
  idlePrompt: string;
  interaction?: TableInteraction | null;
  /** Opens the "Report a problem" dialog. */
  onReport?: () => void;
  /** Replaces the Menu link (troubleshooting uses its own exit). */
  menuHref?: string;
  children?: ReactNode;
};

export function Table({
  model,
  seed,
  showTour,
  veiled,
  hotseat,
  history,
  idlePrompt,
  interaction,
  onReport,
  menuHref = "/",
  children,
}: TableProps) {
  const [peek, setPeek] = useState<PeekCard | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [aidOpen, setAidOpen] = useState(false);
  const closeAid = useCallback(() => setAidOpen(false), []);
  if (veiled && peek !== null) setPeek(null);
  const setPeekSafe = useCallback(
    (card: PeekCard | null) => {
      if (!tourOpen && !veiled) setPeek(card);
    },
    [tourOpen, veiled],
  );
  const yourTurn = model.activePlayer === hotseat;
  const live = model.phase !== "setup" && model.phase !== "over";

  return (
    <PeekContext.Provider value={{ setPeek: setPeekSafe }}>
      <div className="table-shell flex h-dvh w-full text-stone-100">
        <HistoryRail events={veiled ? [] : history} viewer={hotseat} />

        <main className="flex min-w-0 flex-1 flex-col overflow-clip">
          {/* Opponent strip: portrait and numbers on the left, face-down hand in the middle. */}
          <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-start gap-3 border-b border-[var(--line)] bg-black/20 px-3 py-2">
            <PlayerBar
              seat="opponent"
              name={playerLabel(model.opponent.id)}
              partyId={model.opponent.partyId}
              monuments={model.opponent.monuments}
              setAside={model.opponent.setAside}
              partisans={model.opponent.partisans}
              electionWins={model.opponent.electionWins}
              electorates={model.opponent.electorates}
              lords={model.opponent.lords}
              active={!yourTurn && live}
            />
            <Hand cards={model.opponent.hand} variant="opponent" />
            <div className="flex items-center justify-end gap-3 text-[0.65rem] text-stone-500">
              {showTour ? (
                <TableTour
                  allowAutoOpen={showTour}
                  onVisibilityChange={(open) => {
                    setTourOpen(open);
                    if (open) setPeek(null);
                  }}
                />
              ) : null}
              {veiled ? null : (
                <button
                  type="button"
                  onClick={() => {
                    setPeek(null);
                    setAidOpen(true);
                  }}
                  className="cursor-pointer tracking-[0.14em] uppercase hover:text-stone-300"
                >
                  Player aid
                </button>
              )}
              {onReport ? (
                <button
                  type="button"
                  onClick={() => {
                    setPeek(null);
                    onReport();
                  }}
                  className="cursor-pointer tracking-[0.14em] uppercase hover:text-stone-300"
                  title="Send the developer this game's moves and a description"
                >
                  Report
                </button>
              ) : null}
              <span className="tabular-nums" title="Deterministic setup seed">
                Seed {seed}
              </span>
              <Link href={menuHref} className="tracking-[0.14em] uppercase hover:text-stone-300">
                Menu
              </Link>
            </div>
          </div>

          {/* The four districts. */}
          <div className="grid min-h-0 flex-1 grid-cols-4">
            {model.districtOrder.map((district, index) => (
              <Lane
                key={district}
                district={district}
                policyId={model.policies[district]}
                opponent={{
                  cards: model.opponent.tableau[district],
                  support: model.opponent.support[district],
                  influence: model.opponent.influence[district],
                }}
                you={{
                  cards: model.you.tableau[district],
                  support: model.you.support[district],
                  influence: model.you.influence[district],
                }}
                electors={model.electors ? model.electors[district] : null}
                tourAnchor={index === 0}
                target={
                  interaction?.targetDistrict === district
                    ? { label: interaction.targetLabel, onSelect: () => interaction.onSelectDistrict(district) }
                    : null
                }
              />
            ))}
          </div>

          {/* Your strip, then the hand, which bleeds off the bottom edge. */}
          <div className="shrink-0 border-t border-[var(--line)] bg-black/20 px-3 pt-1.5">
            <PlayerBar
              seat="you"
              name={`${playerLabel(model.you.id)} (you)`}
              partyId={model.you.partyId}
              monuments={model.you.monuments}
              setAside={model.you.setAside}
              partisans={model.you.partisans}
              electionWins={model.you.electionWins}
              electorates={model.you.electorates}
              lords={model.you.lords}
              active={yourTurn && live}
            />
          </div>
          <div className="relative h-[calc(var(--card-hand)*1.364*0.7)] shrink-0 bg-black/20">
            <div className="absolute inset-x-0 bottom-0 flex translate-y-[28%] justify-center">
              <Hand
                cards={model.you.hand}
                variant="you"
                tourId="your-hand"
                tags={model.you.handTags}
                playableIds={interaction?.playableHandIds}
                selectableIds={interaction?.selectableHandIds}
                selectedIds={interaction?.selectedHandIds}
                onSelect={interaction?.onSelectHand}
              />
            </div>
          </div>
        </main>

        <SidePanel
          senate={model.senate}
          senateVotes={model.senateVotes}
          senateVotesNeeded={model.senateVotesNeeded}
          convinced={interaction?.convincedSenators}
          revealVotes={interaction?.revealVotes ?? null}
          seatArmed={interaction?.seatArmed ?? false}
          decrees={model.decrees}
          market={model.market}
          electionActive={model.electionActive}
          electionsOut={model.electionsOut}
          monuments={model.availableMonuments}
          deckCount={model.deckCount}
          takeableIds={interaction?.takeableMarketIds}
          marketMode={interaction?.marketMode}
          selectedIds={interaction?.selectedHandIds}
          onTake={interaction?.onTakeMarket}
          claimableIds={interaction?.claimableMonumentIds}
          onClaimMonument={interaction?.onClaimMonument}
          dock={
            <TurnDock
              phase={model.phase}
              seatColor={yourTurn ? "var(--you)" : "var(--opp)"}
              prompt={interaction?.prompt ?? idlePrompt}
              banner={interaction?.banner ?? null}
              actions={interaction?.extraActions ?? []}
            />
          }
        />

        {children}
        {aidOpen && !veiled ? <PlayerAid onClose={closeAid} /> : null}
        {tourOpen || veiled || aidOpen ? null : <ZoomPreview card={peek} />}
      </div>
    </PeekContext.Provider>
  );
}
