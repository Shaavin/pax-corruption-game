"use client";

import { CardView } from "./CardView";
import { DISTRICT_LABEL } from "./Lane";
import { NetworkIcon } from "./NetworkIcon";
import { resolveCard, type FixtureCard } from "./layout-fixture";
import type { DistrictId } from "@/lib/cards/schema";

type NetworkTrayProps = {
  cards: FixtureCard[];
  /** Districts where your network is enabled (listed in the label's tooltip). */
  districts: DistrictId[];
  playableIds?: ReadonlySet<string>;
  selectableIds?: ReadonlySet<string>;
  selectedIds?: ReadonlySet<string>;
  onSelect?: (instanceId: string) => void;
  blockedReasons?: ReadonlyMap<string, string>;
  /** The selected hand card can move in: the box lights up and takes the click. */
  target?: { label: string; onSelect: () => void } | null;
};

/**
 * Your network: face-up cards outside the hand limit, usable as if in hand. Laid out
 * like the Market (a straight row of cards), so it reads as a separate, public zone
 * rather than part of the fan.
 */
export function NetworkTray({
  cards,
  districts,
  playableIds,
  selectableIds,
  selectedIds,
  onSelect,
  blockedReasons,
  target,
}: NetworkTrayProps) {
  const enabledText =
    districts.length > 0
      ? `enabled in ${districts.map((district) => DISTRICT_LABEL[district]).join(", ")}`
      : "no district enabled right now";
  return (
    <section
      aria-label="Your network"
      className={[
        target ? "lane-target" : "",
        // Cards sized from the hand strip's visible height (card-hand × 1.364 × 0.7) minus the
        // box's padding and border, so the box never rises into the player row.
        "relative flex shrink-0 items-stretch gap-1.5 rounded-xl border border-[var(--you)]/60 bg-[rgb(12_15_20/0.82)] py-1.5 pr-2 pl-1 shadow-[0_6px_18px_rgba(0,0,0,0.45)] [--card-panel:max(1.25rem,calc(var(--card-hand)*0.7-1.4rem))] max-[480px]:max-w-[40vw] max-[480px]:pr-1.5",
      ].join(" ")}
    >
      {/*
        A spine label, reading bottom to top. It fills the height the cards give it and never
        sets it (absolute inside a fixed-width column), so the box can't grow into the player row.
      */}
      <span
        className="relative w-3.5 shrink-0 overflow-hidden rounded-md bg-[var(--you)]/12"
        title={`Your network (${enabledText}): revealed cards outside your hand limit, usable as if in hand. Move cards in or out during your turn.`}
      >
        <span className="absolute inset-0 flex rotate-180 items-center justify-center gap-0.5 text-[0.45rem] leading-none font-bold tracking-[0.06em] whitespace-nowrap text-[var(--you)] uppercase [writing-mode:vertical-rl]">
          {/* The same mark as the district plates; upright despite the spine's rotation. */}
          <NetworkIcon className="size-2 rotate-180" />
          Network
        </span>
      </span>
      {cards.length === 0 ? (
        <div className="flex aspect-[825/1125] w-[var(--card-panel)] items-center justify-center rounded-md border border-dashed border-[var(--you)]/35 px-0.5 text-center text-[0.5rem] leading-tight text-stone-400">
          Empty
        </div>
      ) : (
        <ol className="flex gap-1 max-[480px]:overflow-x-auto max-[480px]:[scrollbar-width:none]" aria-label={`Your network, ${cards.length} ${cards.length === 1 ? "card" : "cards"}`}>
          {cards.map((entry) => {
            const catalog = resolveCard(entry.cardId);
            const playable = playableIds?.has(entry.instanceId) ?? false;
            const selectable = selectableIds?.has(entry.instanceId) ?? playable;
            const selected = selectedIds?.has(entry.instanceId) ?? false;
            return (
              <li key={entry.instanceId}>
                <CardView
                  name={catalog.name}
                  art={catalog.art}
                  size="panel"
                  cardId={entry.cardId}
                  motionKey={entry.instanceId}
                  playable={playable || selectable}
                  selected={selected}
                  unavailable={Boolean(selectableIds) && !selectable}
                  selectLabel={selectable ? `${selected ? "Deselect" : "Choose"} ${catalog.name} (in your network)` : undefined}
                  onSelect={selectable && onSelect ? () => onSelect(entry.instanceId) : undefined}
                  blockedReason={selectable ? undefined : blockedReasons?.get(entry.instanceId)}
                />
              </li>
            );
          })}
        </ol>
      )}
      {target ? (
        <button
          type="button"
          className="absolute inset-0 z-20 cursor-pointer rounded-xl"
          aria-label={`${target.label}: your network`}
          onClick={target.onSelect}
        >
          <span className="absolute inset-x-2 bottom-1.5 rounded-full bg-[var(--act)] px-2 py-0.5 text-center text-[0.6rem] font-semibold tracking-wide text-stone-950 shadow-lg">
            {target.label}
          </span>
        </button>
      ) : null}
    </section>
  );
}
