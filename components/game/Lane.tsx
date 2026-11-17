"use client";

import type { CSSProperties } from "react";
import { CardView } from "./CardView";
import { InfoTip } from "./InfoTip";
import { TugBar, tugStateText } from "./TugBar";
import { useNotice } from "./notice";
import { resolveCard, type FixtureCard } from "./layout-fixture";
import { CardKind, type DistrictId, type PolicyIdValue } from "@/lib/cards/schema";
import type { DistrictInfluence } from "@/lib/game/influence";

export const DISTRICT_LABEL: Record<DistrictId, string> = {
  dragonara: "Dragonara",
  horsard: "Horsard",
  shavvinne: "Shavvinne",
  smarbbit: "Smarbbit",
};

type Side = {
  cards: FixtureCard[];
  support: number;
  influence: DistrictInfluence;
};

type LaneProps = {
  district: DistrictId;
  policyId: PolicyIdValue | null;
  you: Side;
  opponent: Side;
  /** Electors at stake, shown during an election. */
  electors: number | null;
  /** Who would win the district now, card effects included. Falls back to raw influence. */
  leader?: "you" | "opponent" | null;
  /** True for the first lane: anchors the table tour. */
  tourAnchor?: boolean;
  /** Your half is a legal target for the selected card. */
  target?: { label: string; onSelect: () => void } | null;
  /** Opens the district's policy options. */
  onShowPolicies?: () => void;
  /** Cards in play that can be picked right now (e.g. Century Inc.'s alliance to replace). */
  pickable?: InPlayPick | null;
  /** Popularity Victory pills, for each seat whose best lead is in this district. */
  /** Popularity Victory: whether it's active, and the support lead it needs. */
  popularityRule?: { active: boolean; target: number };
  /** Grid column (1–4): lanes share rows with the center band above the plates. */
  column: number;
};

export type InPlayPick = {
  /** instanceId → button label */
  labels: ReadonlyMap<string, string>;
  onPick: (instanceId: string) => void;
};

/**
 * One district, Snap-style: the opponent's cards hang down toward the district
 * plate, yours rise up toward it, and the plate shows who leads.
 */
export function Lane({ district, policyId, you, opponent, electors, leader, tourAnchor, target, onShowPolicies, pickable, popularityRule, column }: LaneProps) {
  const lane = { "--lane": `var(--${district})` } as CSSProperties;
  return (
    <section
      aria-label={`${DISTRICT_LABEL[district]} district`}
      // Rows (shared with the other lanes via subgrid): their cards, the center band, the plate, yours.
      className="lane row-span-4 row-start-1 grid min-h-0 min-w-0 grid-rows-subgrid border-x border-[var(--line)]"
      style={{ ...lane, gridColumn: column }}
    >
      <div className="lane-cell row-start-1 flex min-h-0 flex-col justify-end overflow-hidden px-1.5 pt-1.5">
        <LaneCards cards={opponent.cards} side="opponent" pickable={pickable} />
      </div>

      <div className="lane-cell row-start-3">
      <Plate
        district={district}
        policyId={policyId}
        you={you}
        opponent={opponent}
        electors={electors}
        leader={leader}
        onShowPolicies={onShowPolicies}
        tourAnchor={tourAnchor}
        popularityRule={popularityRule}
      />
      </div>

      <div
        className={[
          "lane-cell relative row-start-4 flex min-h-0 flex-col justify-start overflow-hidden px-1.5 pb-1.5",
          target ? "lane-target rounded-b-xl" : "",
        ].join(" ")}
      >
        <LaneCards cards={you.cards} side="you" tourId={tourAnchor ? "your-tableau" : undefined} pickable={pickable} />
        {target ? (
          <button
            type="button"
            className="absolute inset-0 z-20 cursor-pointer"
            aria-label={`${target.label} ${DISTRICT_LABEL[district]}`}
            onClick={target.onSelect}
          >
            <span className="absolute inset-x-3 bottom-2 rounded-full bg-[var(--act)] px-2 py-1 text-center text-[0.65rem] font-semibold tracking-wide text-stone-950 shadow-lg @max-[15rem]:inset-x-1 @max-[15rem]:px-1 @max-[15rem]:text-[0.55rem]">
              {target.label}
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function LaneCards({
  cards,
  side,
  tourId,
  pickable,
}: {
  cards: FixtureCard[];
  side: "you" | "opponent";
  tourId?: string;
  pickable?: InPlayPick | null;
}) {
  if (cards.length === 0) {
    return (
      <div
        className={[
          "mx-auto my-1 flex aspect-[825/1125] w-[var(--card-board)] items-center justify-center rounded-[0.32em] border border-dashed border-white/10",
          side === "opponent" ? "mt-auto" : "",
        ].join(" ")}
        aria-hidden
      />
    );
  }
  // Alliances first, then civils. Rows of up to 4 (5+ cards split into two rows);
  // cards overlap more as a row fills instead of shrinking.
  const ordered = [
    ...cards.filter((card) => resolveCard(card.cardId).kind === CardKind.Alliance),
    ...cards.filter((card) => resolveCard(card.cardId).kind !== CardKind.Alliance),
  ];
  const perRow = ordered.length <= 4 ? 4 : Math.ceil(ordered.length / 2);
  const rows: FixtureCard[][] = [];
  for (let i = 0; i < ordered.length; i += perRow) rows.push(ordered.slice(i, i + perRow));
  // The first row sits next to the district plate on both sides of the lane.
  if (side === "opponent") rows.reverse();
  return (
    <div data-tour={tourId} data-motion-side={side} className="flex flex-col items-center gap-1 py-1">
      {rows.map((row, rowIndex) => {
        const overlap = row.length >= 5 ? 0.42 : row.length === 4 ? 0.2 : 0;
        return (
          <ul key={rowIndex} className="flex justify-center">
            {row.map((entry, index) => {
              const catalog = resolveCard(entry.cardId);
              return (
                <li
                  key={entry.instanceId}
                  className="relative hover:z-30"
                  style={{
                    marginLeft: index === 0 ? 0 : `calc(var(--card-board) * -${overlap})`,
                    zIndex: index + 1,
                  }}
                >
                  <CardView
                    name={catalog.name}
                    art={catalog.art}
                    faceUp={entry.faceUp}
                    size="board"
                    cardId={entry.cardId}
                    motionKey={entry.instanceId}
                    {...(pickable?.labels.has(entry.instanceId)
                      ? {
                          playable: true,
                          selectLabel: pickable.labels.get(entry.instanceId),
                          onSelect: () => pickable.onPick(entry.instanceId),
                        }
                      : {})}
                  />
                </li>
              );
            })}
          </ul>
        );
      })}
    </div>
  );
}

function Plate({
  district,
  policyId,
  you,
  opponent,
  electors,
  leader: tallied,
  tourAnchor,
  onShowPolicies,
  popularityRule,
}: {
  district: DistrictId;
  policyId: PolicyIdValue | null;
  you: Side;
  opponent: Side;
  electors: number | null;
  leader?: "you" | "opponent" | null;
  tourAnchor?: boolean;
  onShowPolicies?: () => void;
  /** Popularity Victory: whether it's active, and the support lead it needs. */
  popularityRule?: { active: boolean; target: number };
}) {
  const policy = policyId ? resolveCard(policyId) : null;
  const lead = you.influence.total - opponent.influence.total;
  const byInfluence: "you" | "opponent" | null = lead > 0 ? "you" : lead < 0 ? "opponent" : null;
  // Card effects (Diet of Saints, Divine Inquisitors, Civil Service) can decide a district regardless of influence.
  const leader = tallied === undefined ? byInfluence : tallied;
  const overridden = tallied !== undefined && tallied !== byInfluence;
  const ring =
    leader === "you" ? "var(--you)" : leader === "opponent" ? "var(--opp)" : "rgb(255 255 255 / 0.1)";

  return (
    <div
      data-tour={tourAnchor ? "district" : undefined}
      title={
        overridden
          ? leader === null
            ? "A card effect stops either player from winning this district right now"
            : `A card effect wins this district for ${leader === "you" ? "you" : "your opponent"}, whatever the influence`
          : undefined
      }
      // The policy card stays beside the stats; only phone-narrow lanes (under 9rem) stack it below.
      className="relative z-10 mx-1.5 flex shrink-0 items-center gap-2 overflow-hidden rounded-xl bg-[rgb(12_15_20/0.85)] px-2 pt-2 pb-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.45)] @max-[15rem]:mx-0.5 @max-[15rem]:gap-1.5 @max-[15rem]:rounded-lg @max-[15rem]:px-1.5 @max-[15rem]:py-1 @max-[9rem]:flex-col @max-[9rem]:items-stretch @max-[9rem]:gap-1 @max-[9rem]:px-1"
      style={{ boxShadow: `0 0 0 1px ${ring}, 0 6px 18px rgba(0,0,0,0.45)` }}
    >
      {/* The district's color along the top edge (the ring around the plate is who leads). */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: `var(--${district})` }} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 shrink-0 rounded-full shadow-[0_0_8px_var(--glow)]"
            style={{ background: `var(--${district})`, "--glow": `var(--${district})` } as CSSProperties}
            aria-hidden
          />
          <span
            className="truncate text-[0.7rem] font-semibold tracking-[0.12em] uppercase @max-[15rem]:text-[0.55rem] @max-[15rem]:tracking-[0.04em]"
            style={{ color: `var(--${district})` }}
          >
            {DISTRICT_LABEL[district]}
          </span>
          <span className="contents @max-[15rem]:hidden">
          <InfoTip label="How to read a district">
            The top row is <b>influence</b>, theirs on the left and yours on the right: civil card
            values + 1 per support-pile card (+1 per Planet Next banked card in Horsard). The higher
            total wins the district at an election; the plate border shows who leads. Below,
            the <b>support piles</b> pull a tug-of-war: lead by 9 in one district to declare
            Popularity Victory.
          </InfoTip>
          </span>
          {electors !== null ? (
            <span
              className="ml-auto shrink-0 rounded-full bg-[var(--act)]/15 px-1.5 text-[0.55rem] font-semibold text-[var(--act)] @max-[15rem]:px-1 @max-[15rem]:text-[0.5rem]"
              title="Electors this district awards in the current election"
            >
              {electors}
              <span className="@max-[15rem]:hidden"> {electors === 1 ? "elector" : "electors"}</span>
              <span className="hidden @max-[15rem]:inline"> el.</span>
            </span>
          ) : null}
        </div>
        <InfluenceRow you={you} opponent={opponent} leader={leader} />
        <PopularityTug you={you.support} opponent={opponent.support} rule={popularityRule} district={district} />
      </div>
      <div className="flex shrink-0 flex-col items-center gap-0.5 @max-[9rem]:items-stretch">
        {policy ? (
          <span className="flex justify-center">
            <CardView name={policy.name} art={policy.art} size="mini" cardId={policyId ?? undefined} />
          </span>
        ) : (
          <div className="flex aspect-[825/1125] w-[var(--card-mini)] items-center justify-center overflow-hidden rounded-[0.32em] border border-dashed border-white/20 text-[0.5rem] font-medium tracking-wide text-stone-400 [writing-mode:vertical-rl] @max-[15rem]:text-[0.45rem] @max-[15rem]:tracking-normal @max-[9rem]:aspect-auto @max-[9rem]:w-full @max-[9rem]:py-0.5 @max-[9rem]:[writing-mode:horizontal-tb]">
            Neutral
          </div>
        )}
        {onShowPolicies ? (
          <button
            type="button"
            onClick={onShowPolicies}
            aria-label={`${DISTRICT_LABEL[district]} policy options`}
            title="See this district's policies and what a proposal could change"
            className="relative cursor-pointer rounded px-0.5 text-[0.5rem] font-semibold tracking-[0.08em] text-stone-300 uppercase after:absolute after:-inset-x-1 after:-inset-y-2 after:content-[''] hover:bg-white/8 hover:text-stamp-blue @max-[15rem]:text-[0.45rem]"
          >
            Policies
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Influence side by side: the opponent on the left, you on the right (like the Military tug-of-war). */
function InfluenceRow({ you, opponent, leader }: { you: Side; opponent: Side; leader: "you" | "opponent" | null }) {
  const notify = useNotice();
  const text = (who: "Your" | "Their", side: Side) =>
    `${who} influence here: ${side.influence.total} (${side.influence.civil} from civil cards + ${side.influence.support} from the support pile${side.influence.bank ? ` + ${side.influence.bank} banked` : ""}${side.influence.bonus ? ` + ${side.influence.bonus} from abilities` : ""}). More influence wins the district at an election.`;
  const cell = (seat: "you" | "opponent") => {
    const side = seat === "you" ? you : opponent;
    const color = seat === "you" ? "var(--you)" : "var(--opp)";
    const leads = leader === seat;
    const explain = text(seat === "you" ? "Your" : "Their", side);
    const label = (
      <span
        // The tiniest lanes (small phones) keep the side, color, and ▲; the word won't fit.
        className="text-[0.55rem] font-semibold tracking-[0.1em] uppercase @max-[15rem]:text-[0.45rem] @max-[15rem]:tracking-normal @max-[6rem]:hidden"
        style={{ color }}
      >
        {seat === "you" ? "You" : "Opp"}
      </span>
    );
    const value = (
      <span
        className={["text-base font-semibold tabular-nums @max-[15rem]:text-sm", leads ? "" : "text-stone-300"].join(" ")}
        style={leads ? { color } : undefined}
      >
        {side.influence.total}
      </span>
    );
    const tag = leads ? (
      // Not color alone: say who leads.
      <span
        className="rounded-sm px-1 text-[0.5rem] font-bold tracking-[0.08em] uppercase @max-[15rem]:px-0 @max-[15rem]:text-[0.55rem]"
        style={{ color, background: "color-mix(in srgb, currentColor 14%, transparent)" }}
        aria-label={seat === "you" ? "You lead here" : "They lead here"}
      >
        <span className="@max-[15rem]:hidden">leads</span>
        <span aria-hidden className="hidden @max-[15rem]:inline">▲</span>
      </span>
    ) : null;
    return (
      <span
        className={["flex cursor-help items-center gap-1", seat === "you" ? "flex-row-reverse" : ""].join(" ")}
        title={explain}
        onClick={() => notify(explain)}
      >
        {label}
        {value}
        {tag}
      </span>
    );
  };
  return (
    <div className="flex items-center justify-between gap-1 leading-none">
      {cell("opponent")}
      <span className="text-[0.5rem] tracking-[0.12em] text-stone-500 uppercase @max-[20rem]:hidden">influence</span>
      {cell("you")}
    </div>
  );
}

/** Popularity Victory as a tug-of-war of this district's support piles (lead by 9). */
function PopularityTug({
  you,
  opponent,
  rule,
  district,
}: {
  you: number;
  opponent: number;
  rule?: { active: boolean; target: number };
  district: DistrictId;
}) {
  const target = rule?.target ?? 9;
  return (
    <TugBar
      label="Pop."
      you={you}
      opponent={opponent}
      target={target}
      active={rule?.active ?? true}
      explain={(lead, state) =>
        `Popularity in ${DISTRICT_LABEL[district]}: support piles you ${you}, opponent ${opponent}${
          lead === 0 ? " (even)" : ` (${lead > 0 ? "you" : "they"} lead by ${Math.abs(lead)})`
        }. Lead by ${target} in one district for Popularity Victory.${tugStateText(state)}`
      }
    />
  );
}

