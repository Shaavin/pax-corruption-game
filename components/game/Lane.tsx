"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { CardBack, CardView } from "./CardView";
import { InfoTip } from "./InfoTip";
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
export function Lane({ district, policyId, you, opponent, electors, leader, tourAnchor, target, onShowPolicies, pickable }: LaneProps) {
  const lane = { "--lane": `var(--${district})` } as CSSProperties;
  return (
    <section
      aria-label={`${DISTRICT_LABEL[district]} district`}
      className="lane flex h-full min-h-0 min-w-0 flex-col border-x border-[var(--line)]"
      style={lane}
    >
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-1.5 pt-1.5">
        <LaneCards cards={opponent.cards} side="opponent" pickable={pickable} />
      </div>

      <Plate
        district={district}
        policyId={policyId}
        you={you}
        opponent={opponent}
        electors={electors}
        leader={leader}
        onShowPolicies={onShowPolicies}
        tourAnchor={tourAnchor}
      />

      <div
        className={[
          "relative flex min-h-0 flex-1 flex-col justify-start overflow-hidden px-1.5 pb-1.5",
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
            <span className="absolute inset-x-3 bottom-2 rounded-full bg-[var(--act)] px-2 py-1 text-center text-[0.65rem] font-semibold tracking-wide text-stone-950 shadow-lg @max-[10rem]:inset-x-1 @max-[10rem]:px-1 @max-[10rem]:text-[0.55rem]">
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
    <div data-tour={tourId} className="flex flex-col items-center gap-1 py-1">
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
}: {
  district: DistrictId;
  policyId: PolicyIdValue | null;
  you: Side;
  opponent: Side;
  electors: number | null;
  leader?: "you" | "opponent" | null;
  tourAnchor?: boolean;
  onShowPolicies?: () => void;
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
      className="relative z-10 mx-1.5 flex shrink-0 items-center gap-2 rounded-xl bg-[rgb(12_15_20/0.85)] px-2 py-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.45)] @max-[10rem]:mx-0.5 @max-[10rem]:flex-col @max-[10rem]:items-stretch @max-[10rem]:gap-1 @max-[10rem]:rounded-lg @max-[10rem]:px-1 @max-[10rem]:py-1"
      style={{ boxShadow: `0 0 0 1px ${ring}, 0 6px 18px rgba(0,0,0,0.45)` }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: `var(--${district})` }}
            aria-hidden
          />
          <span className="truncate text-[0.7rem] font-semibold tracking-[0.12em] text-stone-100 uppercase @max-[10rem]:text-[0.55rem] @max-[10rem]:tracking-[0.04em]">
            {DISTRICT_LABEL[district]}
          </span>
          <span className="contents @max-[10rem]:hidden">
          <InfoTip label="How to read a district">
            <b>Inf</b> is influence: civil card values + 1 per support-pile card (+1 per
            Planet Next banked card in Horsard). The higher total wins the district at an
            election; the plate border shows who leads. <b>Pop</b> is the support-pile count:
            lead by 9 in one district to declare Popularity Victory.
          </InfoTip>
          </span>
          {electors !== null ? (
            <span
              className="ml-auto shrink-0 rounded-full bg-[var(--act)]/15 px-1.5 text-[0.55rem] font-semibold text-[var(--act)] @max-[10rem]:px-1 @max-[10rem]:text-[0.5rem]"
              title="Electors this district awards in the current election"
            >
              {electors} el.
            </span>
          ) : null}
        </div>
        <ScoreRow label="Opp" side={opponent} color="var(--opp)" leading={leader === "opponent"} />
        <ScoreRow label="You" side={you} color="var(--you)" leading={leader === "you"} />
      </div>
      <div className="flex shrink-0 flex-col items-center gap-0.5 @max-[10rem]:items-stretch">
        {policy ? (
          <CardView name={policy.name} art={policy.art} size="mini" cardId={policyId ?? undefined} />
        ) : (
          <div className="flex aspect-[825/1125] w-[var(--card-mini)] items-center justify-center rounded-[0.32em] border border-dashed border-white/20 text-[0.5rem] font-medium tracking-wide text-stone-400 @max-[10rem]:aspect-auto @max-[10rem]:w-full @max-[10rem]:py-0.5 @max-[10rem]:text-[0.45rem]">
            Neutral
          </div>
        )}
        {onShowPolicies ? (
          <button
            type="button"
            onClick={onShowPolicies}
            aria-label={`${DISTRICT_LABEL[district]} policy options`}
            title="See this district's policies and what a proposal could change"
            className="cursor-pointer rounded px-1 text-[0.5rem] font-semibold tracking-[0.1em] text-stone-400 uppercase hover:bg-white/8 hover:text-[var(--brass)] @max-[10rem]:text-[0.45rem]"
          >
            Policies
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ScoreRow({
  label,
  side,
  color,
  leading,
  tour,
}: {
  label: string;
  side: Side;
  color: string;
  leading: boolean;
  tour?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 leading-none" data-tour={tour}>
      <span className="w-6 text-[0.55rem] font-semibold tracking-[0.1em] uppercase @max-[10rem]:w-auto @max-[10rem]:text-[0.45rem] @max-[10rem]:tracking-normal" style={{ color }}>
        {label}
      </span>
      <span
        className={["text-base font-semibold tabular-nums @max-[10rem]:text-sm", leading ? "" : "text-stone-300"].join(" ")}
        style={leading ? { color } : undefined}
        title={`Influence ${side.influence.total}: ${side.influence.civil} civil + ${side.influence.support} support${side.influence.bank ? ` + ${side.influence.bank} banked` : ""}${side.influence.bonus ? ` + ${side.influence.bonus} from abilities` : ""}`}
      >
        {side.influence.total}
      </span>
      <span className="text-[0.5rem] tracking-[0.1em] text-stone-500 uppercase @max-[10rem]:hidden">inf</span>
      <span className="ml-auto flex items-center gap-1" title={`${side.support} card${side.support === 1 ? "" : "s"} in the support pile (popularity)`}>
        <span className="contents @max-[10rem]:hidden">
          <PileIcon count={side.support} />
        </span>
        <span className="text-xs font-semibold tabular-nums text-stone-200 @max-[10rem]:text-[0.6rem] @max-[10rem]:text-stone-400">
          {side.support}
        </span>
        <span className="text-[0.5rem] tracking-[0.1em] text-stone-500 uppercase @max-[10rem]:hidden">pop</span>
      </span>
    </div>
  );
}

function PileIcon({ count }: { count: number }) {
  if (count === 0) {
    return <span className="block aspect-[825/1125] w-3 rounded-[2px] border border-dashed border-white/20" aria-hidden />;
  }
  return (
    <span className="relative block aspect-[825/1125] w-3 overflow-hidden rounded-[2px] ring-1 ring-black/60" aria-hidden>
      <Image src={CardBack.common} alt="" fill sizes="12px" className="object-cover" draggable={false} />
    </span>
  );
}

