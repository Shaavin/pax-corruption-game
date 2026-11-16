"use client";

import { useNotice } from "./notice";
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
  /** Cards your opponent can see: marked with an eye. */
  revealedIds?: ReadonlySet<string>;
};

/** Degrees between neighbouring cards in the fan, capped so big hands stay readable. */
function fanStep(count: number): number {
  return count <= 1 ? 0 : Math.min(5, 26 / (count - 1));
}

/** Fraction of a card width each card tucks under its neighbour. */
function overlapFor(count: number): number {
  return Math.min(0.58, Math.max(0.12, 0.07 * count));
}

export function Hand({
  cards,
  variant,
  tourId,
  tags,
  playableIds,
  selectableIds,
  selectedIds,
  onSelect,
  blockedReasons,
  revealedIds,
}: HandProps) {
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
        const revealed = revealedIds?.has(entry.instanceId) ?? false;
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
              selectLabel={
                selectable
                  ? `${selected ? "Deselect" : "Choose"} ${catalog.name}${revealed ? " (your opponent can see it)" : ""}`
                  : undefined
              }
              onSelect={selectable && onSelect ? () => onSelect(entry.instanceId) : undefined}
              blockedReason={selectable ? undefined : blockedReasons?.get(entry.instanceId)}
            />
            {revealed ? <RevealedEye /> : null}
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

/**
 * Like MTGA and Hearthstone: an eye on a card in your hand means your opponent knows it
 * (you took it face up from the Market, or it sits in a face-up zone).
 */
function RevealedEye() {
  const notify = useNotice();
  return (
    <span
      role="img"
      aria-label="Revealed to your opponent"
      onClick={(event) => {
        // Explain instead of choosing the card underneath.
        event.stopPropagation();
        notify("Your opponent can see this card: it was taken face up (from the Market, for example) or sits in a face-up zone.");
      }}
      title="Your opponent can see this card"
      // Floats just above the card's top-left corner: the next card in the fan covers the right side.
      className="pointer-events-auto absolute -top-[0.7rem] left-[9%] z-30 flex h-[1.45rem] w-[1.45rem] cursor-help items-center justify-center rounded-full bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_0_0_1.5px_rgb(10_12_16),0_0_12px_rgb(239_68_68/0.75),0_4px_8px_rgb(0_0_0/0.6)]"
    >
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z" />
        <circle cx="8" cy="8" r="2" fill="currentColor" />
      </svg>
    </span>
  );
}
