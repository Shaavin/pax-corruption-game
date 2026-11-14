"use client";

import { useState, type CSSProperties } from "react";
import { CardView } from "./CardView";
import { resolveCard, type FixtureCard } from "./layout-fixture";

type HandProps = {
  cards: FixtureCard[];
  /** "you": large fanned hand that bleeds off the bottom edge. "opponent": small backs. */
  variant: "you" | "opponent";
  tourId?: string;
  /** Small labels on specific cards (e.g. "Banked"). */
  tags?: Record<string, string>;
  playableIds?: ReadonlySet<string>;
  selectableIds?: ReadonlySet<string>;
  selectedIds?: ReadonlySet<string>;
  onSelect?: (instanceId: string) => void;
  /** Why a card can't be chosen right now (shown when it's tapped). */
  blockedReasons?: ReadonlyMap<string, string>;
};

/** Degrees between neighbouring cards in the fan, capped so big hands stay readable. */
function fanStep(count: number): number {
  return count <= 1 ? 0 : Math.min(5, 26 / (count - 1));
}

/** Fraction of a card width each card tucks under its neighbour. */
function overlapFor(count: number): number {
  return Math.min(0.58, Math.max(0.12, 0.07 * count));
}

export function Hand({ cards, variant, tourId, tags, playableIds, selectableIds, selectedIds, onSelect, blockedReasons }: HandProps) {
  const [hover, setHover] = useState<number | null>(null);

  if (variant === "opponent") {
    return (
      <ul className="flex items-start" data-motion-origin="hand-opponent" aria-label={`Opponent hand, ${cards.length} cards`}>
        {cards.map((entry, index) => {
          const mid = (cards.length - 1) / 2;
          const turn = (index - mid) * -fanStep(cards.length) * 0.7;
          return (
            <li
              key={entry.instanceId}
              style={{
                marginLeft: index === 0 ? 0 : "calc(var(--card-mini) * -0.55)",
                transform: `rotate(${turn}deg) translateY(${Math.abs(index - mid) * 1.5}px)`,
                transformOrigin: "50% 0%",
              }}
            >
              <CardView
                name={resolveCard(entry.cardId).name}
                art={resolveCard(entry.cardId).art}
                faceUp={entry.faceUp}
                size="mini"
                motionKey={entry.instanceId}
              />
            </li>
          );
        })}
      </ul>
    );
  }

  const mid = (cards.length - 1) / 2;
  const step = fanStep(cards.length);
  const overlap = overlapFor(cards.length);

  return (
    <ul
      data-tour={tourId}
      data-motion-zone="hand-you"
      data-motion-origin="hand-you"
      aria-label={`Your hand, ${cards.length} cards`}
      className="flex items-end justify-center"
    >
      {cards.map((entry, index) => {
        const catalog = resolveCard(entry.cardId);
        const playable = playableIds?.has(entry.instanceId) ?? false;
        const selectable = selectableIds?.has(entry.instanceId) ?? playable;
        const selected = selectedIds?.has(entry.instanceId) ?? false;
        const offset = index - mid;
        const lifted = hover === index;
        const style: CSSProperties = {
          marginLeft: index === 0 ? 0 : `calc(var(--card-hand) * -${overlap})`,
          zIndex: lifted ? 50 : selected ? 40 : index + 1,
          transform: lifted
            ? "translateY(-34%) scale(1.14)"
            : selected
              ? `translateY(-20%) rotate(${offset * step * 0.5}deg)`
              : `translateY(${Math.abs(offset) ** 1.6 * 3}px) rotate(${offset * step}deg)`,
        };
        return (
          <li
            key={entry.instanceId}
            className="hand-card relative"
            data-selected={selected}
            style={style}
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
          >
            <CardView
              name={catalog.name}
              art={catalog.art}
              faceUp={entry.faceUp}
              size="hand"
              playable={playable || selectable}
              selected={selected}
              dimmed={Boolean(selectableIds) && !selectable}
              cardId={entry.cardId}
              motionKey={entry.instanceId}
              peekDelay={600}
              selectLabel={selectable ? (selected ? `Deselect ${catalog.name}` : `Choose ${catalog.name}`) : undefined}
              onSelect={selectable && onSelect ? () => onSelect(entry.instanceId) : undefined}
              blockedReason={selectable ? undefined : blockedReasons?.get(entry.instanceId)}
            />
            {tags?.[entry.instanceId] ? (
              <span className="pointer-events-none absolute top-1 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[var(--you)] px-2 py-0.5 text-[0.55rem] font-bold tracking-wide text-stone-950 uppercase shadow">
                {tags[entry.instanceId]}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
