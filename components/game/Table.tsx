"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { playCardMotion } from "./card-motion";
import { NoticeProvider, useNotice } from "./notice";
import { markPrimerSeen, Primer, usePrimerSeen } from "./Primer";
import { Hand } from "./Hand";
import { HistoryRail } from "./HistoryRail";
import { Lane, type InPlayPick } from "./Lane";
import { PeekContext, type PeekCard } from "./peek";
import { PlayerAid } from "./PlayerAid";
import { PlayerBar } from "./PlayerBar";
import { usePlayerLabel } from "./players";
import { SharedZones, sharedNeedsAttention, SidePanel, TurnDock, type DockBanner, type ExtraAction, type ZoneProps } from "./SidePanel";
import { useCompact, useCompactLandscape } from "./use-compact";
import type { TableModel } from "./table-model";
import { ActionCards, type ActionCardSpec } from "./ActionCards";
import { PolicyChooser } from "./PolicyChooser";
import { markTourSeen, TableTour, tableTourSteps, useTourSeen, type TourView } from "./TableTour";
import { ZoomPreview } from "./ZoomPreview";
import type { DistrictId } from "@/lib/cards/schema";
import type { GameEvent, GameModeId, PlayerId } from "@/lib/game";
import { GAME_MODES } from "@/lib/game/setup";

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
  /** Expansion: events the active player can buy now, and what clicking one does. */
  buyableEventIds?: ReadonlySet<string>;
  onBuyEvent?: (instanceId: string) => void;
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
  /** Special actions shown as cards beside the hand. */
  actionCards?: ActionCardSpec[];
  /** Why each unavailable hand card can't be chosen (tapping it says so). */
  handBlockedReasons?: ReadonlyMap<string, string>;
  /** Cards in play to click (Century Inc.: the alliance to replace). */
  inPlayPick?: InPlayPick | null;
};

type TableProps = {
  model: TableModel;
  /** Null online: the seed would reveal every shuffle. */
  seed: number | null;
  mode?: GameModeId;
  /** Legacy & Diplomacy is in play (expansion player aid, labels). */
  expansion?: boolean;
  showTour: boolean;
  veiled: boolean;
  hotseat: PlayerId;
  history: readonly GameEvent[];
  /** Shown in the turn dock when it isn't this seat's move (setup, waiting, game over). */
  idlePrompt: string;
  interaction?: TableInteraction | null;
  /** Opens the "Report a problem" dialog. */
  onReport?: () => void;
  /** Extra menu entries (online: rejoin link, turn alerts). */
  extraMenu?: TableMenuItem[];
  /** Replaces the Menu link (troubleshooting uses its own exit). */
  menuHref?: string;
  children?: ReactNode;
};

/** An extra menu entry. A returned string is shown as a short note (e.g. "Link copied"). */
export type TableMenuItem = {
  label: string;
  title?: string;
  onClick: () => string | void | Promise<string | void>;
};

/** The game table, with a note area for "why can't I?" messages. */
export function Table(props: TableProps) {
  return (
    <NoticeProvider>
      <TableView {...props} />
    </NoticeProvider>
  );
}

function TableView({
  model,
  seed,
  mode = "standard",
  expansion = false,
  showTour,
  veiled,
  hotseat,
  history,
  idlePrompt,
  interaction,
  onReport,
  extraMenu,
  menuHref = "/",
  children,
}: TableProps) {
  const playerLabel = usePlayerLabel();
  const [peek, setPeek] = useState<PeekCard | null>(null);
  const notify = useNotice();
  const [aidOpen, setAidOpen] = useState(false);
  const [policyFocus, setPolicyFocus] = useState<DistrictId | null>(null);
  const closePolicies = useCallback(() => setPolicyFocus(null), []);
  const closeAid = useCallback(() => setAidOpen(false), []);
  if (veiled && peek !== null) setPeek(null);
  const compact = useCompact();
  // The tour opens by itself the first time a game reaches play, and again from the menu.
  const tourSeen = useTourSeen();
  const [tourRequest, setTourRequest] = useState<"auto" | "open" | "closed">("auto");
  const [tourStep, setTourStep] = useState(0);
  // First game: "How to play" comes first, then the table guide.
  const primerSeen = usePrimerSeen();
  const [primerRequest, setPrimerRequest] = useState<"auto" | "open" | "closed">("auto");
  const [primerPage, setPrimerPage] = useState(0);
  const primerOpen = showTour && (primerRequest === "open" || (primerRequest === "auto" && !primerSeen));
  const primerFirstRun = primerRequest === "auto";
  const openPrimer = useCallback(() => {
    setPeek(null);
    setAidOpen(false);
    setPrimerPage(0);
    setPrimerRequest("open");
  }, []);
  const closePrimer = useCallback(() => {
    markPrimerSeen();
    setPrimerRequest("closed");
    setPrimerPage(0);
  }, []);
  const tourOpen =
    showTour && !primerOpen && (tourRequest === "open" || (tourRequest === "auto" && !tourSeen));
  const tourSteps = useMemo(() => tableTourSteps({ compact, expansion }), [compact, expansion]);
  const step = Math.min(tourStep, tourSteps.length - 1);
  const tourView: TourView | null = tourOpen ? (tourSteps[step]?.view ?? null) : null;
  const openTour = useCallback(() => {
    setPeek(null);
    setAidOpen(false);
    setTourStep(0);
    setTourRequest("open");
  }, []);
  const closeTour = useCallback(() => {
    markTourSeen();
    setTourRequest("closed");
    setTourStep(0);
  }, []);
  const setPeekSafe = useCallback(
    (card: PeekCard | null) => {
      if (!tourOpen && !primerOpen && !veiled) setPeek(card);
    },
    [tourOpen, primerOpen, veiled],
  );
  // Slide cards from where they were (captured just before the change) to where they are now.
  useLayoutEffect(() => {
    playCardMotion(hotseat);
  }, [model, hotseat, compact]);
  const yourTurn = model.activePlayer === hotseat;
  const live = model.phase !== "setup" && model.phase !== "over";

  const zoneProps: ZoneProps = {
    senate: model.senate,
    senateVotes: model.senateVotes,
    senateVotesNeeded: model.senateVotesNeeded,
    convinced: interaction?.convincedSenators,
    revealVotes: interaction?.revealVotes ?? null,
    seatArmed: interaction?.seatArmed ?? false,
    decrees: model.decrees,
    market: model.market,
    electionActive: model.electionActive,
    electionsOut: model.electionsOut,
    electionsOngoing: model.electionsOngoing,
    race: model.race,
    monuments: model.availableMonuments,
    deckCount: model.deckCount,
    takeableIds: interaction?.takeableMarketIds,
    marketMode: interaction?.marketMode,
    selectedIds: interaction?.selectedHandIds,
    onTake: interaction?.onTakeMarket,
    claimableIds: interaction?.claimableMonumentIds,
    expansion: model.expansion,
    buyableIds: interaction?.buyableEventIds,
    onBuy: interaction?.onBuyEvent,
    onClaimMonument: interaction?.onClaimMonument,
  };
  const dock = (
    <TurnDock
      phase={model.phase}
      seatColor={yourTurn ? "var(--you)" : "var(--opp)"}
      prompt={interaction?.prompt ?? idlePrompt}
      banner={interaction?.banner ?? null}
      actions={interaction?.extraActions ?? []}
    />
  );
  const lanes = (
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
          leader={model.districtLeader?.[district]}
          tourAnchor={index === 0}
          pickable={interaction?.inPlayPick ?? null}
          onShowPolicies={
            veiled
              ? undefined
              : () => {
                  setPeek(null);
                  setPolicyFocus(district);
                }
          }
          target={
            interaction?.targetDistrict === district
              ? { label: interaction.targetLabel, onSelect: () => interaction.onSelectDistrict(district) }
              : null
          }
        />
      ))}
    </div>
  );
  const actionCards = interaction?.actionCards ?? [];
  const hand = (
    <div className="relative h-[calc(var(--card-hand)*1.364*0.7)] shrink-0 bg-black/20">
      {compact ? null : (
        <div className="absolute right-4 bottom-0 z-10 translate-y-[24%]">
          <ActionCards cards={actionCards} variant="hand" />
        </div>
      )}
      <div
        className="absolute inset-x-0 bottom-0 flex translate-y-[28%] justify-center"
        // Keep the fan clear of the action cards on the right.
        style={
          !compact && actionCards.length > 0
            ? { paddingRight: `calc(${actionCards.length} * (var(--card-hand) * 0.86 + 0.5rem) + 1.5rem)` }
            : undefined
        }
      >
        <Hand
          cards={model.you.hand}
          variant="you"
          tourId="your-hand"
          tags={model.you.handTags}
          playableIds={interaction?.playableHandIds}
          selectableIds={interaction?.selectableHandIds}
          selectedIds={interaction?.selectedHandIds}
          onSelect={interaction?.onSelectHand}
          blockedReasons={interaction?.handBlockedReasons}
        />
      </div>
    </div>
  );
  const overlays = (
    <>
      {children}
      {aidOpen && !veiled ? <PlayerAid onClose={closeAid} expansion={expansion} /> : null}
      {tourOpen || primerOpen || veiled || aidOpen ? null : <ZoomPreview card={peek} />}
      {policyFocus && !veiled ? (
        <PolicyChooser
          districtOrder={model.districtOrder}
          policies={model.policies}
          frozen={model.policyFrozen}
          onChoose={null}
          focus={policyFocus}
          onClose={closePolicies}
        />
      ) : null}
      {tourOpen ? <TableTour steps={tourSteps} step={step} onStep={setTourStep} onClose={closeTour} /> : null}
      {primerOpen ? (
        <Primer page={primerPage} onPage={setPrimerPage} onClose={closePrimer} firstRun={primerFirstRun} />
      ) : null}
    </>
  );
  const modeLabel = `${GAME_MODES.find((entry) => entry.id === mode)?.name ?? mode}${expansion ? " + L&D" : ""} · ${
    seed === null ? "Online" : `Seed ${seed}`
  }`;

  if (compact) {
    return (
      <PeekContext.Provider value={{ setPeek: setPeekSafe }}>
        <CompactTable
          model={model}
          hotseat={hotseat}
          veiled={veiled}
          history={history}
          live={live}
          yourTurn={yourTurn}
          zoneProps={zoneProps}
          targetDistrict={interaction?.targetDistrict ?? null}
          lanes={lanes}
          dock={dock}
          hand={
            <>
              {actionCards.length > 0 ? (
                <div className="shrink-0 border-t border-[var(--line)] bg-black/30">
                  <ActionCards cards={actionCards} variant="strip" />
                </div>
              ) : null}
              {hand}
            </>
          }
          modeLabel={modeLabel}
          menuHref={menuHref}
          onPlayerAid={() => {
            setPeek(null);
            setAidOpen(true);
          }}
          onReport={onReport}
          extraMenu={extraMenu}
          onTour={showTour ? openTour : undefined}
          onPrimer={showTour ? openPrimer : undefined}
          pinnedView={tourView}
          clearPeek={() => setPeek(null)}
          peekOpen={peek !== null}
        >
          {overlays}
        </CompactTable>
      </PeekContext.Provider>
    );
  }

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
                <>
                  <button
                    type="button"
                    onClick={openPrimer}
                    className="cursor-pointer tracking-[0.14em] uppercase hover:text-stone-300"
                  >
                    How to play
                  </button>
                  <button
                    type="button"
                    onClick={openTour}
                    className="cursor-pointer tracking-[0.14em] uppercase hover:text-stone-300"
                  >
                    Table guide
                  </button>
                </>
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
              {(extraMenu ?? []).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={async () => {
                    const note = await item.onClick();
                    if (note) notify(note);
                  }}
                  className="cursor-pointer tracking-[0.14em] uppercase hover:text-stone-300"
                  title={item.title}
                >
                  {item.label}
                </button>
              ))}
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
              <span className="tabular-nums" title="Draw-deck mode and deterministic setup seed">
                {modeLabel}
              </span>
              <Link href={menuHref} className="tracking-[0.14em] uppercase hover:text-stone-300">
                Menu
              </Link>
            </div>
          </div>

          {/* The four districts. */}
          {lanes}

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
          {hand}
        </main>

        <SidePanel {...zoneProps} dock={dock} />

        {overlays}
      </div>
    </PeekContext.Provider>
  );
}

type CompactTableProps = {
  model: TableModel;
  hotseat: PlayerId;
  veiled: boolean;
  history: readonly GameEvent[];
  live: boolean;
  yourTurn: boolean;
  zoneProps: ZoneProps;
  targetDistrict: DistrictId | null;
  lanes: ReactNode;
  dock: ReactNode;
  hand: ReactNode;
  modeLabel: string;
  menuHref: string;
  onPlayerAid: () => void;
  onReport?: () => void;
  extraMenu?: TableMenuItem[];
  /** Opens the table guide (absent while it can't run, e.g. during setup). */
  onTour?: () => void;
  /** Opens "How to play". */
  onPrimer?: () => void;
  /** The tour holds the view on the half it's pointing at. */
  pinnedView: CompactView | null;
  clearPeek: () => void;
  peekOpen: boolean;
  children: ReactNode;
};

type CompactView = "districts" | "table";

/**
 * Phone layout: one column. The districts and the shared table (Senate, Market,
 * monuments…) take turns in the middle; your strip, the turn controls, and your
 * hand stay put underneath. The history rail becomes a drawer.
 */
function CompactTable({
  model,
  hotseat,
  veiled,
  history,
  live,
  yourTurn,
  zoneProps,
  targetDistrict,
  lanes,
  dock,
  hand,
  modeLabel,
  menuHref,
  onPlayerAid,
  onReport,
  extraMenu,
  onTour,
  onPrimer,
  pinnedView,
  clearPeek,
  peekOpen,
  children,
}: CompactTableProps) {
  const playerLabel = usePlayerLabel();
  const [chosenView, setView] = useState<CompactView>("districts");
  const notify = useNotice();
  const view = pinnedView ?? chosenView;
  const [logOpen, setLogOpen] = useState(false);
  const landscape = useCompactLandscape();
  const attention = sharedNeedsAttention(zoneProps);

  // Follow the game to where the next decision is (players can still switch back):
  // a card waiting for a district or a new action step → districts;
  // a monument to claim or income → table.
  const wanted: CompactView | null = targetDistrict
    ? "districts"
    : (zoneProps.claimableIds?.size ?? 0) > 0 || (model.phase === "income" && attention)
      ? "table"
      : model.phase === "action"
        ? "districts"
        : null;
  const [lastWanted, setLastWanted] = useState<CompactView | null>(wanted);
  if (wanted !== lastWanted) {
    setLastWanted(wanted);
    if (wanted) setView(wanted);
  }

  // Touch: a tap anywhere closes the card preview (a tap on a card opens the next one).
  useEffect(() => {
    if (!peekOpen) return;
    const close = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") clearPeek();
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [peekOpen, clearPeek]);

  const panelStyle = { "--card-panel": "min(4.4rem, 16.5vw)" } as CSSProperties;

  const opponentBar = (
    <div
      data-motion-origin="hand-opponent"
      className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] bg-black/30 px-2 py-1.5"
    >
      <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
        <PlayerBar
          compact
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
          handCount={model.opponent.hand.length}
        />
      </div>
      <details className="relative shrink-0">
        <summary
          aria-label="Menu"
          className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-lg text-stone-300 ring-1 ring-white/15 [&::-webkit-details-marker]:hidden"
        >
          ⋯
        </summary>
        <div className="absolute top-11 right-0 z-[60] flex w-52 flex-col rounded-xl border border-white/10 bg-[#0d1117] p-1.5 text-sm shadow-2xl">
          <p className="px-3 py-1.5 text-xs text-stone-500 tabular-nums">{modeLabel}</p>
          {onPrimer ? <MenuButton onClick={onPrimer}>How to play</MenuButton> : null}
          {onTour ? <MenuButton onClick={onTour}>Table guide</MenuButton> : null}
          {veiled ? null : <MenuButton onClick={onPlayerAid}>Player aid</MenuButton>}
          {(extraMenu ?? []).map((item) => (
            <MenuButton
              key={item.label}
              onClick={async () => {
                const note = await item.onClick();
                if (note) notify(note);
              }}
            >
              {item.label}
            </MenuButton>
          ))}
          {onReport ? <MenuButton onClick={onReport}>Report a problem</MenuButton> : null}
          <Link href={menuHref} className="rounded-lg px-3 py-2 text-stone-200 hover:bg-white/8">
            Leave game
          </Link>
        </div>
      </details>
    </div>
  );

  const viewBar = (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--line)] bg-black/20 px-2 py-1.5">
      <div role="tablist" aria-label="View" className="flex flex-1 rounded-full bg-white/[0.06] p-0.5 ring-1 ring-white/10">
        <ViewTab selected={view === "districts"} onClick={() => setView("districts")}>
          Districts
        </ViewTab>
        <ViewTab selected={view === "table"} onClick={() => setView("table")} badge={attention && view !== "table"}>
          Senate · Market
        </ViewTab>
      </div>
      <button
        data-tour="history"
        type="button"
        onClick={() => setLogOpen(true)}
        className="shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold text-stone-300 ring-1 ring-white/15"
      >
        Log
      </button>
    </div>
  );

  const middle = (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {view === "districts" ? (
        lanes
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 [scrollbar-width:thin]" style={panelStyle}>
          <SharedZones {...zoneProps} />
        </div>
      )}
    </div>
  );

  const yourBar = (
    <div className="shrink-0 overflow-x-auto border-t border-[var(--line)] bg-black/30 px-2 py-1.5 [scrollbar-width:none]">
      <PlayerBar
        compact
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
  );

  const logDrawer = logOpen ? (
    <div className="fixed inset-0 z-[70] flex">
      <div className="h-full bg-[#0a0c10]">
        <HistoryRail events={veiled ? [] : history} viewer={hotseat} />
      </div>
      <button
        type="button"
        aria-label="Close the log"
        onClick={() => setLogOpen(false)}
        className="flex-1 cursor-pointer bg-black/60"
      />
    </div>
  ) : null;

  if (landscape) {
    // Sideways: the board and hand on the left, everything about the turn on the right.
    return (
      <div className="table-shell flex h-dvh w-full text-stone-100">
        <div className="flex min-w-0 flex-1 flex-col">
          {middle}
          {hand}
        </div>
        <div className="flex w-[17rem] shrink-0 flex-col border-l border-[var(--line)] bg-black/25">
          {opponentBar}
          {viewBar}
          <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">{dock}</div>
          {yourBar}
        </div>
        {logDrawer}
        {children}
      </div>
    );
  }

  return (
    <div className="table-shell flex h-dvh w-full flex-col text-stone-100">
      {opponentBar}
      {viewBar}
      {middle}
      {yourBar}
      <div className="max-h-[38dvh] shrink-0 overflow-y-auto border-t border-[var(--line)] bg-black/40 px-2.5 py-2">{dock}</div>
      {hand}
      {logDrawer}
      {children}
    </div>
  );
}

function ViewTab({
  selected,
  onClick,
  badge,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  badge?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={[
        "relative flex-1 cursor-pointer rounded-full px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition",
        selected ? "bg-stone-100 text-stone-950" : "text-stone-400",
      ].join(" ")}
    >
      {children}
      {badge ? (
        <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-[var(--act)] shadow-[0_0_8px_var(--act)]" aria-label="needs you" />
      ) : null}
    </button>
  );
}

function MenuButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.currentTarget.closest("details")?.removeAttribute("open");
        onClick();
      }}
      className="cursor-pointer rounded-lg px-3 py-2 text-left text-stone-200 hover:bg-white/8"
    >
      {children}
    </button>
  );
}
