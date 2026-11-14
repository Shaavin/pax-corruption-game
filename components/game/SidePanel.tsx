"use client";

import type { ReactNode } from "react";
import { CardBack, CardView } from "./CardView";
import { InfoTip } from "./InfoTip";
import { resolveCard } from "./layout-fixture";
import type { DecreeView, ExpansionView, RaceView } from "./table-model";
import { VictoryRace } from "./VictoryRace";
import { useNotice } from "./notice";
import { getEvent, isEventId, VICTORY_CARDS, WORLD_POWER_NAME } from "@/lib/cards/expansion";
import { getCard } from "@/lib/cards/catalog";
import { CardKind } from "@/lib/cards/schema";
import { senatorVotes } from "@/lib/game/senate";
import type { CardInstance } from "@/lib/game/types";

export type ExtraAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  /** primary = the highlighted "act" colour; neutral = pass/skip; ghost = cancel. */
  tone?: "primary" | "neutral" | "ghost";
};

export type DockBanner = { tone: "win" | "warn"; text: string };

export type PhaseStep = "action" | "politics" | "income" | "decree" | "setup" | "over";

type SidePanelProps = {
  senate: CardInstance[];
  senateVotes: number;
  senateVotesNeeded: number;
  convinced?: ReadonlySet<number>;
  revealVotes: number | null;
  /** Seating a card: the rightmost Senator leaves to your support pile. */
  seatArmed?: boolean;
  decrees: DecreeView[];
  market: CardInstance[];
  electionActive: boolean;
  /** How close each player is to each victory (null during setup). */
  race?: RaceView | null;
  electionsOut: number;
  /** Of `electionsOut`, those revealed during the election under way. */
  electionsOngoing: number;
  monuments: CardInstance[];
  deckCount: number;
  takeableIds?: ReadonlySet<string>;
  /** "take" at income; "use" for State Enterprise (as if in hand). */
  marketMode?: "take" | "use";
  /** Market cards currently selected (State Enterprise plays them as if in hand). */
  selectedIds?: ReadonlySet<string>;
  onTake?: (instanceId: string) => void;
  claimableIds?: ReadonlySet<string>;
  onClaimMonument?: (instanceId: string) => void;
  /** Legacy & Diplomacy. */
  expansion?: ExpansionView | null;
  /** Events the active player can buy now (income). */
  buyableIds?: ReadonlySet<string>;
  onBuy?: (instanceId: string) => void;
  dock: ReactNode;
};

/** The shared zones' props, without the turn controls. */
export type ZoneProps = Omit<SidePanelProps, "dock">;

/** Shared zones live on the right edge so the four lanes keep the centre of the screen. */
export function SidePanel(props: SidePanelProps) {
  return (
    <aside
      aria-label="Shared table"
      className="relative z-10 flex h-full w-[19.5rem] shrink-0 flex-col border-l border-[var(--line)] bg-black/25"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5 [scrollbar-width:thin]">
        <SharedZones {...props} />
      </div>
      <div className="shrink-0 border-t border-[var(--line)] p-2.5">{props.dock}</div>
    </aside>
  );
}

/** Everything players share (election status, Senate, decrees, Market, world, monuments). */
export function SharedZones(props: ZoneProps) {
  return (
    <>
      <ElectionStatus
        active={props.electionActive}
        electionsOut={props.electionsOut}
        ongoing={props.electionsOngoing}
        marketLeft={props.market.length}
      />
      {props.race ? (
        <Section
          title="Victories"
          tour="victories"
          info={
            <>
              How close each of you is to every victory. Amber: one step away. Gold: can be declared in that
              player&apos;s Politics step. Tap a victory&apos;s <b>i</b> for how it&apos;s won.
            </>
          }
        >
          <VictoryRace race={props.race} />
        </Section>
      ) : null}
      <SenateSection {...props} />
      <DecreeSection decrees={props.decrees} />
      <MarketSection {...props} />
      {props.expansion ? <WorldSection expansion={props.expansion} /> : null}
      <SupplySection {...props} />
    </>
  );
}

/** Whether anything in the shared zones is waiting on the player (for the phone layout's tab badge). */
export function sharedNeedsAttention(props: ZoneProps): boolean {
  return Boolean(
    (props.takeableIds && props.takeableIds.size > 0) ||
      (props.claimableIds && props.claimableIds.size > 0) ||
      (props.buyableIds && props.buyableIds.size > 0) ||
      props.revealVotes !== null ||
      props.seatArmed,
  );
}

function Section({
  title,
  aside,
  tour,
  info,
  motionZone,
  children,
}: {
  title: string;
  aside?: ReactNode;
  tour?: string;
  /** Card motion: new cards here come from the deck. */
  motionZone?: string;
  info?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section data-tour={tour} data-motion-zone={motionZone} className="glass rounded-xl px-2.5 py-2">
      <header className="mb-1.5 flex items-center gap-1.5">
        <h3 className="label">{title}</h3>
        {info ? <InfoTip label={`About ${title}`}>{info}</InfoTip> : null}
        <div className="ml-auto text-[0.65rem] text-stone-400 tabular-nums">{aside}</div>
      </header>
      {children}
    </section>
  );
}

/** Four pills: amber for elections already resolved, green for the one under way, grey for those still in the deck. */
function ElectionStatus({
  active,
  electionsOut,
  ongoing,
  marketLeft,
}: {
  active: boolean;
  electionsOut: number;
  ongoing: number;
  marketLeft: number;
}) {
  const resolved = electionsOut - ongoing;
  return (
    <div
      data-tour="elections"
      className={[
        "flex items-center gap-2 rounded-xl px-3 py-2",
        active ? "bg-[var(--election)]/10 ring-1 ring-[var(--election)]/50" : "glass",
      ].join(" ")}
    >
      <div
        className="flex gap-1"
        role="img"
        aria-label={`${electionsOut} of 4 General Elections revealed${ongoing > 0 ? `, ${ongoing} in the election under way` : ""}`}
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={[
              "h-2 w-5 rounded-full",
              index < resolved
                ? "bg-[var(--act)]"
                : index < electionsOut
                  ? "bg-[var(--election)] shadow-[0_0_8px_var(--election)]"
                  : "bg-white/10",
            ].join(" ")}
          />
        ))}
      </div>
      <div className="min-w-0 text-[0.7rem] leading-tight">
        {active ? (
          <>
            <div className="font-semibold text-[var(--election)]">Election under way</div>
            <div className="text-stone-300">
              Scored when the Market empties · {marketLeft} left
            </div>
          </>
        ) : (
          <div className="text-stone-300">
            General Elections <span className="font-semibold text-stone-100">{electionsOut}/4</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SenateSection({
  senate,
  senateVotes,
  senateVotesNeeded,
  convinced,
  revealVotes,
  seatArmed,
}: ZoneProps) {
  const proposing = revealVotes !== null;
  const passing = proposing && revealVotes >= senateVotesNeeded;
  return (
    <Section
      title="Senate"
      tour="senate"
      info={
        <>
          Civil and conspiracy Senators carry 1 vote, alliances 2. To pass a policy, reveal
          cards that convince more than half: a higher civil of the same district, or another
          alliance of the same district. Conspiracies are never convinced.
        </>
      }
      aside={
        proposing ? (
          <span className={passing ? "font-semibold text-[var(--act)]" : ""}>
            {revealVotes} / {senateVotesNeeded} votes
          </span>
        ) : (
          <>
            {senateVotes} votes · {senateVotesNeeded} to pass
          </>
        )
      }
    >
      <ol className="flex justify-between gap-1">
        {senate.map((entry, index) => {
          const def = getCard(entry.cardId);
          const votes = senatorVotes(entry.cardId);
          const isConvinced = convinced?.has(index) ?? false;
          const leaving = Boolean(seatArmed) && index === senate.length - 1;
          return (
            <li key={entry.instanceId} className="relative">
              <CardView
                name={def.name}
                art={def.art}
                size="panel"
                cardId={entry.cardId}
                motionKey={entry.instanceId}
                selected={isConvinced}
                dimmed={(proposing && !isConvinced) || leaving}
              />
              {leaving ? (
                <span className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 rounded-full bg-[var(--act)] px-1.5 py-0.5 text-[0.5rem] font-bold tracking-wide text-stone-950 uppercase shadow">
                  Leaves
                </span>
              ) : null}
              <span
                className={[
                  "pointer-events-none absolute -right-1 -bottom-1 rounded-md px-1 text-[0.6rem] font-bold tabular-nums ring-1",
                  def.kind === CardKind.Alliance
                    ? "bg-[var(--brass)] text-stone-950 ring-black/40"
                    : "bg-stone-900 text-stone-100 ring-white/20",
                ].join(" ")}
                title={`${votes} vote${votes === 1 ? "" : "s"}`}
              >
                {votes}
              </span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function DecreeSection({ decrees }: { decrees: DecreeView[] }) {
  const active = decrees.filter((decree) => decree.active).length;
  return (
    <Section
      title="Decrees"
      tour="decrees"
      aside={`${active}/4 active`}
      info={
        <>
          Election winners activate one decree per General Election revealed. Active decrees
          add shared symbols. Meet any two active decrees at once to declare Political Victory.
          Dots show who meets each one right now.
        </>
      }
    >
      <ol className="flex justify-between gap-1">
        {decrees.map((decree) => {
          const def = getCard(decree.id);
          if (def.kind !== CardKind.Decree) return null;
          return (
            <li key={decree.id} className="flex flex-col items-center gap-1">
              <CardView
                name={decree.active ? def.name : def.inactiveName}
                art={decree.active ? def.art : def.inactiveArt}
                size="panel"
                square
                cardId={decree.id}
                dimmed={!decree.active}
              />
              <span className="flex h-2 items-center gap-1" aria-label={decree.active ? `${def.name}: you ${decree.youMeet ? "meet" : "don't meet"} it; opponent ${decree.theyMeet ? "meets" : "doesn't meet"} it` : `${def.inactiveName}: inactive`}>
                {decree.active ? (
                  <>
                    <Dot on={decree.theyMeet} color="var(--opp)" />
                    <Dot on={decree.youMeet} color="var(--you)" />
                  </>
                ) : (
                  <span className="text-[0.5rem] tracking-wide text-stone-500 uppercase">off</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function Dot({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      className="block h-2 w-2 rounded-full"
      style={on ? { background: color, boxShadow: `0 0 6px ${color}` } : { background: "rgb(255 255 255 / 0.12)" }}
    />
  );
}

function MarketSection({
  market,
  electionActive,
  takeableIds,
  selectedIds,
  onTake,
  marketMode = "take",
  expansion,
  buyableIds,
  onBuy,
}: ZoneProps) {
  const rows = expansion ? expansion.rows : [market];
  return (
    <Section
      title="Market"
      tour="market"
      motionZone="market"
      aside={
        electionActive
          ? "no refill during the election"
          : expansion
            ? `${market.length} cards · events ${expansion.eventDeck} left`
            : `${market.length} cards`
      }
      info={
        expansion ? (
          <>
            Events cost one card per non-event card to their right (fixed for the turn). At income, buy one
            instead of taking a card, while under your hand limit. Events in the last 2 spots leave at the
            next refill.
          </>
        ) : undefined
      }
    >
      {market.length === 0 ? (
        <p className="py-3 text-center text-xs text-stone-500">Empty</p>
      ) : (
        <div className="flex flex-col gap-1.5">
        {rows.map((row, rowIndex) => (
        <ol key={rowIndex} className="grid grid-cols-5 justify-items-center gap-1">
          {row.map((entry) => {
            if (isEventId(entry.cardId)) {
              const event = getEvent(entry.cardId);
              const cost = expansion?.eventCosts[entry.instanceId] ?? 0;
              const buyable = buyableIds?.has(entry.instanceId) ?? false;
              return (
                <li key={entry.instanceId} className="relative">
                  <CardView
                    name={event.name}
                    art={event.art}
                    size="panel"
                    cardId={entry.cardId}
                    motionKey={entry.instanceId}
                    playable={buyable}
                    className="ring-2 ring-[var(--brass)]/60"
                    selectLabel={buyable ? `Buy ${event.name} (costs ${cost})` : undefined}
                    onSelect={buyable && onBuy ? () => onBuy(entry.instanceId) : undefined}
                  />
                  <span
                    className="pointer-events-none absolute -top-1 -left-1 rounded-md bg-[var(--brass)] px-1 text-[0.6rem] font-bold text-stone-950 tabular-nums ring-1 ring-black/40"
                    title={`Event · ${WORLD_POWER_NAME[event.power]} · costs ${cost}`}
                  >
                    ◆{cost}
                  </span>
                </li>
              );
            }
            const catalog = resolveCard(entry.cardId);
            const takeable = takeableIds?.has(entry.instanceId) ?? false;
            return (
              <li key={entry.instanceId}>
                <CardView
                  name={catalog.name}
                  art={catalog.art}
                  faceUp={entry.faceUp}
                  size="panel"
                  cardId={entry.cardId}
                  motionKey={entry.instanceId}
                  playable={takeable}
                  selected={selectedIds?.has(entry.instanceId) ?? false}
                  selectLabel={
                    takeable
                      ? marketMode === "take"
                        ? `Take ${catalog.name}`
                        : `${selectedIds?.has(entry.instanceId) ? "Deselect" : "Use"} ${catalog.name} (State Enterprise)`
                      : undefined
                  }
                  onSelect={takeable && onTake ? () => onTake(entry.instanceId) : undefined}
                />
              </li>
            );
          })}
        </ol>
        ))}
        </div>
      )}
    </Section>
  );
}

const POWER_LETTER = { north: "N", south: "S", east: "E", west: "W" } as const;

/** Legacy & Diplomacy: events in effect, relations with the World Powers, and the victory cards. */
function WorldSection({ expansion }: { expansion: ExpansionView }) {
  return (
    <Section
      title="World"
      tour="world"
      aside={`${expansion.inEffect.length} in effect`}
      info={
        <>
          Events played for their effect apply to both players while in play; East effects only help their
          buyer. Each purchase gives +1 relation with that power. Military, Popularity, Ideological, Cultural,
          and Diplomatic must be activated by a legacy event before anyone can declare them.
        </>
      }
    >
      {expansion.inEffect.length > 0 ? (
        <ol className="mb-2 flex flex-wrap gap-1">
          {expansion.inEffect.map((entry) => {
            const event = getEvent(entry.card.cardId);
            return (
              <li key={entry.card.instanceId} className="relative">
                <CardView name={event.name} art={event.art} size="panel" cardId={entry.card.cardId} motionKey={entry.card.instanceId} />
                <span
                  className={[
                    "pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded px-1 text-[0.5rem] font-bold uppercase ring-1 ring-black/40",
                    entry.owner === "you"
                      ? "bg-[var(--you)] text-stone-950"
                      : entry.owner === "opponent"
                        ? "bg-[var(--opp)] text-stone-950"
                        : "bg-stone-300 text-stone-950",
                  ].join(" ")}
                >
                  {entry.owner === "you" ? "You" : entry.owner === "opponent" ? "Opp" : "All"}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mb-2 text-[0.7rem] text-stone-500">No events in effect.</p>
      )}
      <table className="mb-2 w-full text-center text-[0.7rem] tabular-nums" aria-label="Relations with the World Powers">
        <thead>
          <tr className="text-stone-500">
            <th className="text-left font-normal">Relations</th>
            {expansion.relations.map((entry) => (
              <th key={entry.power} className="font-semibold" title={WORLD_POWER_NAME[entry.power]}>
                {POWER_LETTER[entry.power]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="text-left text-[var(--opp)]">Opp</td>
            {expansion.relations.map((entry) => (
              <td key={entry.power} className={entry.opponent > entry.you ? "font-bold text-stone-100" : "text-stone-400"}>
                {entry.opponent}
              </td>
            ))}
          </tr>
          <tr>
            <td className="text-left text-[var(--you)]">You</td>
            {expansion.relations.map((entry) => (
              <td key={entry.power} className={entry.you > entry.opponent ? "font-bold text-stone-100" : "text-stone-400"}>
                {entry.you}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <ol className="flex justify-between gap-1" aria-label="Expansion victories">
        {expansion.victories.map((entry) => {
          const def = VICTORY_CARDS.find((card) => card.id === entry.id)!;
          return (
            <li key={entry.id} className="flex flex-col items-center gap-0.5">
              <CardView
                name={`${def.name} Victory${entry.active ? "" : " (inactive)"}`}
                art={entry.active ? def.art : def.inactiveArt}
                size="panel"
                square
                dimmed={!entry.active}
              />
              <span className="text-[0.5rem] tracking-wide text-stone-400 uppercase">{entry.active ? "active" : "off"}</span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function SupplySection({ monuments, deckCount, claimableIds, onClaimMonument }: ZoneProps) {
  return (
    <Section title="Monuments" tour="supply" aside={`${deckCount} in the deck`}>
      <div className="flex items-end justify-between gap-1">
        {monuments.map((entry) => {
          const catalog = resolveCard(entry.cardId);
          const claimable = claimableIds?.has(entry.instanceId) ?? false;
          return (
            <CardView
              key={entry.instanceId}
              name={catalog.name}
              art={catalog.art}
              faceUp={entry.faceUp}
              motionKey={`monument:${entry.cardId}`}
              back={CardBack.monument}
              size="panel"
              cardId={entry.cardId}
              playable={claimable}
              selectLabel={claimable ? `Construct ${catalog.name}` : undefined}
              onSelect={claimable && onClaimMonument ? () => onClaimMonument(entry.instanceId) : undefined}
            />
          );
        })}
        <div data-motion-origin="deck" className="ml-1 flex flex-col items-center gap-0.5" title={`${deckCount} cards left in the draw deck`}>
          <CardView name="Draw deck" art={CardBack.common} faceUp={false} size="mini" />
          <span className="text-[0.6rem] font-semibold tabular-nums text-stone-300">{deckCount}</span>
        </div>
      </div>
    </Section>
  );
}

const STEPS: { id: PhaseStep; label: string }[] = [
  { id: "action", label: "Action" },
  { id: "politics", label: "Politics" },
  { id: "income", label: "Income" },
];

/** Bottom-right turn controls: phase ladder, what to do now, and the buttons. */
export function TurnDock({
  phase,
  seatColor,
  prompt,
  banner,
  actions,
}: {
  phase: PhaseStep;
  seatColor: string;
  prompt: string;
  banner?: DockBanner | null;
  actions: ExtraAction[];
}) {
  const notify = useNotice();
  return (
    <div className="flex flex-col gap-2" data-tour="turn">
      <ol className="flex items-center gap-1" aria-label="Turn steps">
        {STEPS.map((step, index) => {
          const current = phase === step.id;
          const done = STEPS.findIndex((entry) => entry.id === phase) > index;
          return (
            <li key={step.id} className="flex flex-1 items-center gap-1">
              <span
                className={[
                  "flex-1 rounded-full px-2 py-1 text-center text-[0.6rem] font-semibold tracking-[0.12em] uppercase transition-colors",
                  current ? "text-stone-950" : done ? "bg-white/8 text-stone-400" : "bg-white/4 text-stone-500",
                ].join(" ")}
                style={current ? { background: seatColor } : undefined}
                aria-current={current ? "step" : undefined}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {banner ? (
        <p
          role="status"
          className={[
            "rounded-lg px-2.5 py-1.5 text-[0.72rem] leading-snug font-semibold ring-1",
            banner.tone === "win"
              ? "bg-[var(--brass)]/15 text-[var(--brass)] ring-[var(--brass)]/50"
              : "bg-[var(--opp)]/15 text-stone-100 ring-[var(--opp)]/50",
          ].join(" ")}
        >
          {banner.tone === "win" ? "★ " : "⚠ "}
          {banner.text}
        </p>
      ) : null}
      <p className="min-h-[2.4em] text-[0.78rem] leading-snug text-stone-200">{prompt}</p>
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              title={action.title}
              // Still clickable when unavailable: it says why (touch screens have no tooltips).
              aria-disabled={action.disabled || undefined}
              onClick={action.disabled ? () => action.title && notify(action.title) : action.onClick}
              className={[
                "cursor-pointer rounded-lg px-3 py-1.5 text-[0.75rem] font-semibold transition-colors aria-disabled:cursor-help aria-disabled:opacity-35",
                action.tone === "ghost"
                  ? "text-stone-300 ring-1 ring-white/15 hover:bg-white/8"
                  : action.tone === "neutral"
                    ? "bg-white/10 text-stone-100 hover:bg-white/16"
                    : "bg-[var(--act)] text-stone-950 hover:brightness-110",
              ].join(" ")}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
