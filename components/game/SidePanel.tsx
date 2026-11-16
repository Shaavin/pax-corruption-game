"use client";

import type { ReactNode } from "react";
import { CardBack, CardView } from "./CardView";
import { InfoTip } from "./InfoTip";
import { resolveCard } from "./layout-fixture";
import type { DecreeView, ExpansionView, RaceView } from "./table-model";
import { seatVictories } from "./victory-marks";
import type { VictoryKindId } from "@/lib/game/types";
import { useNotice } from "./notice";
import { getEvent, isEventId, VICTORY_CARDS, WORLD_POWER_NAME } from "@/lib/cards/expansion";
import { getCard } from "@/lib/cards/catalog";
import { CardKind } from "@/lib/cards/schema";
import { senatorVotes } from "@/lib/game/senate";
import { CULTURAL_LEAD, DIPLOMATIC_POWERS } from "@/lib/game/victory";
import { TugBar, tugStateText } from "./TugBar";
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
  /** Monuments each player has built (Cultural Victory, expansion). */
  builtMonuments?: { you: number; opponent: number };
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
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5 [--zone-pad:0.625rem] [scrollbar-width:thin]">
        <SharedZones {...props} />
      </div>
      <div className="shrink-0 border-t border-[var(--line)] p-2.5">{props.dock}</div>
    </aside>
  );
}

/** Everything players share (election status, Senate, Market, decrees, world, monuments). */
export function SharedZones(props: ZoneProps) {
  return (
    <>
      <ElectionStatus
        active={props.electionActive}
        electionsOut={props.electionsOut}
        ongoing={props.electionsOngoing}
        marketLeft={props.market.length}
        civil={props.race?.civil ?? null}
      />
      <SenateSection {...props} />
      <MarketSection {...props} />
      <DecreeSection decrees={props.decrees} />
      {props.expansion ? <VictoryCardsSection expansion={props.expansion} race={props.race ?? null} /> : null}
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
  civil,
}: {
  active: boolean;
  electionsOut: number;
  ongoing: number;
  marketLeft: number;
  /** Civil Victory outlook: who would win if scored now, and Roman Basilica progress. */
  civil: RaceView["civil"] | null;
}) {
  const resolved = electionsOut - ongoing;
  return (
    // A solid band pinned to the very top of the scrolling panel. It reaches into the panel's
    // padding (`--zone-pad`, set by the scroll container) because a sticky element otherwise
    // stops at the padding edge and lets content show through the gap above it.
    <div className="sticky top-[calc(var(--zone-pad,0px)*-1)] z-20 -mx-[var(--zone-pad,0px)] -mt-[var(--zone-pad,0px)] shrink-0 border-b border-white/10 bg-[#07090c] px-[var(--zone-pad,0px)] pt-[var(--zone-pad,0px)] pb-2 shadow-[0_10px_18px_-8px_rgb(0_0_0/0.9)]">
      <div
        data-tour="elections"
        className={[
          "flex items-center gap-2 rounded-xl px-3 py-2",
          active ? "bg-[var(--election)]/10 ring-1 ring-[var(--election)]/50" : "bg-white/[0.06] ring-1 ring-white/10",
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
          {civil ? <CivilOutlook civil={civil} /> : null}
        </div>
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

/** Civil Victory, on the elections band: who'd win now, and Roman Basilica's early win. */
function CivilOutlook({ civil }: { civil: RaceView["civil"] }) {
  const color = civil.projected === "you" ? "var(--you)" : civil.projected === "opponent" ? "var(--opp)" : undefined;
  const leader = civil.projected === "you" ? "you" : civil.projected === "opponent" ? "your opponent" : null;
  return (
    <div
      className="text-stone-400"
      title={`${leader ? `If the election were scored right now, ${leader} would win it. ` : ""}Civil Victory goes to whoever wins the final election.`}
    >
      Civil: {civil.electionsLeft} left ·{" "}
      <span className="font-semibold" style={{ color }}>
        {civil.projected === "you" ? "you lead" : civil.projected === "opponent" ? "they lead" : "—"}
      </span>
      {civil.basilica ? (
        <>
          {" "}
          · Basilica {civil.basilica.who === "you" ? "(yours)" : "(theirs)"} {civil.basilica.wins}/{civil.basilica.target}
        </>
      ) : null}
    </div>
  );
}

function DecreeSection({ decrees }: { decrees: DecreeView[] }) {
  const active = decrees.filter((decree) => decree.active).length;
  // Political Victory's progress is on the center band; the dots here show who meets each decree.
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
            Cards enter on the left and slide right as the row refills. Events cost one card per non-event card to
            their right (fixed for the turn), so they start dear and get cheaper. At income, buy one instead of
            taking a card, while under your hand limit. Events in the last 2 spots leave at the next refill.
          </>
        ) : undefined
      }
    >
      {market.length === 0 ? (
        <p className="py-3 text-center text-xs text-stone-500">Empty</p>
      ) : (
        <div className="flex flex-col gap-1.5">
        {rows.map((row, rowIndex) => {
        // Expansion rows flow like a conveyor: a short row sits in its right-most spots.
        const offset = expansion && row.length < 5 ? 5 - row.length : 0;
        const at = (index: number) => (index === 0 && offset > 0 ? { gridColumnStart: offset + 1 } : undefined);
        return (
        <ol key={rowIndex} className="grid grid-cols-5 justify-items-center gap-1">
          {row.map((entry, index) => {
            if (isEventId(entry.cardId)) {
              const event = getEvent(entry.cardId);
              const cost = expansion?.eventCosts[entry.instanceId] ?? 0;
              const buyable = buyableIds?.has(entry.instanceId) ?? false;
              return (
                <li key={entry.instanceId} className="relative" style={at(index)}>
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
              <li key={entry.instanceId} style={at(index)}>
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
        );
        })}
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
          buyer. Each purchase gives +1 relation with that power.
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
      <RelationsTable expansion={expansion} />
    </Section>
  );
}

/**
 * Relations with the four World Powers. Each power's column takes the color of whoever has the
 * higher relation there (a "Leads" row says it in words), and a line below counts those leads
 * toward Diplomatic Victory.
 */
function RelationsTable({ expansion }: { expansion: ExpansionView }) {
  const lead = (entry: ExpansionView["relations"][number]) =>
    entry.you > entry.opponent ? "you" : entry.opponent > entry.you ? "opponent" : null;
  const yourLeads = expansion.relations.filter((entry) => lead(entry) === "you").length;
  const theirLeads = expansion.relations.filter((entry) => lead(entry) === "opponent").length;
  const active = expansion.victories.find((entry) => entry.id === "diplomatic")?.active ?? false;
  const best = Math.max(yourLeads, theirLeads);
  const state = !active ? "off" : best >= DIPLOMATIC_POWERS ? "met" : best === DIPLOMATIC_POWERS - 1 ? "close" : "far";
  const tint = (who: "you" | "opponent" | null) =>
    who === "you"
      ? "bg-[var(--you)]/15"
      : who === "opponent"
        ? "bg-[var(--opp)]/15"
        : "";
  return (
    <>
      <table className="w-full border-separate border-spacing-x-0.5 text-center text-[0.7rem] tabular-nums" aria-label="Relations with the World Powers">
        <thead>
          <tr className="text-stone-500">
            <th className="text-left font-normal">Relations</th>
            {expansion.relations.map((entry) => (
              <th
                key={entry.power}
                className={["rounded-t font-semibold", tint(lead(entry))].join(" ")}
                style={{ color: lead(entry) === "you" ? "var(--you)" : lead(entry) === "opponent" ? "var(--opp)" : undefined }}
                title={WORLD_POWER_NAME[entry.power]}
              >
                {POWER_LETTER[entry.power]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["opponent", "you"] as const).map((seat) => (
            <tr key={seat}>
              <td className="text-left" style={{ color: seat === "you" ? "var(--you)" : "var(--opp)" }}>
                {seat === "you" ? "You" : "Opp"}
              </td>
              {expansion.relations.map((entry) => (
                <td
                  key={entry.power}
                  className={[tint(lead(entry)), lead(entry) === seat ? "font-bold text-stone-50" : "text-stone-400"].join(" ")}
                >
                  {entry[seat]}
                </td>
              ))}
            </tr>
          ))}
          <tr className="text-[0.55rem] tracking-wide uppercase">
            <td className="text-left text-stone-500">Leads</td>
            {expansion.relations.map((entry) => {
              const who = lead(entry);
              return (
                <td
                  key={entry.power}
                  className={["rounded-b font-bold", tint(who)].join(" ")}
                  style={{ color: who === "you" ? "var(--you)" : who === "opponent" ? "var(--opp)" : "rgb(120 113 108)" }}
                >
                  {who === "you" ? "You" : who === "opponent" ? "Opp" : "–"}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      <p
        className={["mt-1.5 flex items-center gap-1.5 text-[0.65rem] text-stone-300", state === "off" ? "opacity-50" : ""].join(" ")}
        title={`Diplomatic Victory: a higher relation than the other player with ${DIPLOMATIC_POWERS} of the 4 World Powers.${state === "off" ? " Not active yet: a legacy event must activate it first." : ""}`}
      >
        <span className="font-semibold tracking-[0.12em] text-stone-200 uppercase">Diplomatic</span>
        <span style={{ color: "var(--you)" }}>You {yourLeads}</span>
        <span className="text-stone-500">·</span>
        <span style={{ color: "var(--opp)" }}>Opp {theirLeads}</span>
        <span className="text-stone-500">of {DIPLOMATIC_POWERS} needed</span>
        {state === "off" ? <span className="text-stone-500">off</span> : null}
        {state === "close" ? <span className="font-bold text-amber-300 uppercase">1 away</span> : null}
        {state === "met" ? <span className="font-bold text-[var(--act)] uppercase">Win ★</span> : null}
      </p>
    </>
  );
}

/** Legacy Victories: the five extra ways to win that legacy events unlock (expansion). */
function VictoryCardsSection({ expansion, race }: { expansion: ExpansionView; race: RaceView | null }) {
  const active = expansion.victories.filter((entry) => entry.active).length;
  const standings = { you: seatVictories(race, "you"), opponent: seatVictories(race, "opponent") };
  /** Whether this seat could declare the victory now (it's unlocked and the condition is met). */
  const claimable = (kind: VictoryKindId, seat: "you" | "opponent") => {
    const victory = standings[seat][kind];
    return Boolean(victory?.active && victory.standing.met);
  };
  return (
    <Section
      title="Legacy Victories"
      tour="victory-cards"
      aside={`${active}/${expansion.victories.length} unlocked`}
      info={
        <>
          Extra ways to win, on top of Civil and Political. Military, Popularity, Ideological, Cultural, and Diplomatic
          start locked; a legacy event can unlock one, and from then on either player may win by it.
        </>
      }
    >
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
              {entry.active ? (
                // Like the decree dots: lit for whoever can claim this victory right now.
                <span
                  className="flex h-2 items-center gap-1"
                  aria-label={`${def.name} Victory: you ${claimable(entry.id, "you") ? "can" : "can't"} claim it; opponent ${claimable(entry.id, "opponent") ? "can" : "can't"}`}
                >
                  <Dot on={claimable(entry.id, "opponent")} color="var(--opp)" />
                  <Dot on={claimable(entry.id, "you")} color="var(--you)" />
                </span>
              ) : (
                <span className="text-[0.5rem] tracking-wide text-stone-500 uppercase">off</span>
              )}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function SupplySection({ monuments, deckCount, claimableIds, onClaimMonument, expansion, builtMonuments }: ZoneProps) {
  const cultural = expansion?.victories.find((entry) => entry.id === "cultural");
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
      {cultural && builtMonuments ? (
        <div className="mt-2 border-t border-white/[0.07] pt-2">
          <TugBar
            label="Cultural"
            you={builtMonuments.you}
            opponent={builtMonuments.opponent}
            target={CULTURAL_LEAD}
            active={cultural.active}
            explain={(lead, state) =>
              `Cultural Victory: monuments built, you ${builtMonuments.you}, opponent ${builtMonuments.opponent}${
                lead === 0 ? " (even)" : ` (${lead > 0 ? "you" : "they"} lead by ${Math.abs(lead)})`
              }. Build ${CULTURAL_LEAD} more monuments than the other player to win.${tugStateText(state)}`
            }
          />
        </div>
      ) : null}
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
