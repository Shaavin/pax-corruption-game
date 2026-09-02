"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CardView } from "./CardView";
import { resolveCard, type FixtureCard } from "./layout-fixture";
import { CardKind } from "@/lib/cards/schema";

type TableauProps = {
  cards: FixtureCard[];
  anchor: "top" | "bottom";
  tourId?: string;
};

const MIN_PEEK = 22;
const CIVIL_COLUMN = 3;

function columnsOf(cards: FixtureCard[], size: number): FixtureCard[][] {
  if (cards.length === 0) return [[]];
  const columns: FixtureCard[][] = [];
  for (let i = 0; i < cards.length; i += size) {
    columns.push(cards.slice(i, i + size));
  }
  return columns;
}

export function Tableau({ cards, anchor, tourId }: TableauProps) {
  const alliances = cards.filter(
    (entry) => resolveCard(entry.cardId).kind === CardKind.Alliance,
  );
  const civils = cards.filter(
    (entry) => resolveCard(entry.cardId).kind === CardKind.Civil,
  );

  return (
    <div
      className={[
        "flex h-full min-h-0 min-w-0 justify-center gap-0.5 px-0.5 py-0.5",
        anchor === "top" ? "items-start" : "items-end",
      ].join(" ")}
    >
      <CardStack cards={alliances} anchor={anchor} emptyLabel="Alliance" />
      {columnsOf(civils, CIVIL_COLUMN).map((column, index) => (
        <CardStack
          key={index}
          cards={column}
          anchor={anchor}
          emptyLabel="Civil"
          tourId={index === 0 ? tourId : undefined}
        />
      ))}
    </div>
  );
}

function CardStack({
  cards,
  anchor,
  emptyLabel,
  tourId,
}: {
  cards: FixtureCard[];
  anchor: "top" | "bottom";
  emptyLabel: string;
  tourId?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [overlap, setOverlap] = useState(0);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || cards.length === 0) return;

    const measure = () => {
      const first = frame.querySelector("[data-stack-card]");
      if (!(first instanceof HTMLElement)) return;
      const cardH = first.offsetHeight;
      const available = frame.clientHeight;
      if (cardH <= 0 || available <= 0) return;

      if (cards.length === 1) {
        setOverlap(0);
        setScale(available < cardH ? available / cardH : 1);
        return;
      }

      const n = cards.length;
      const needed = (peek: number) => cardH + (n - 1) * peek;
      let peek = (available - cardH) / (n - 1);
      let nextScale = 1;

      if (peek > cardH * 0.5) peek = cardH * 0.5;
      if (peek < MIN_PEEK) {
        peek = MIN_PEEK;
        nextScale = Math.min(1, available / needed(MIN_PEEK));
      }

      setOverlap(cardH - peek);
      setScale(nextScale);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [cards.length]);

  return (
    <div
      ref={frameRef}
      className={[
        "flex h-full w-[var(--card-board)] shrink-0 overflow-hidden",
        anchor === "top" ? "items-start" : "items-end",
        "justify-center",
      ].join(" ")}
    >
      {cards.length === 0 ? (
        <div
          aria-label={`Empty ${emptyLabel.toLowerCase()} slot`}
          className="flex aspect-[825/1125] w-full items-center justify-center rounded-[0.22em] border border-dashed border-white/15 bg-black/10 text-center text-[0.5rem] font-semibold tracking-[0.12em] text-stone-500 uppercase"
        >
          {emptyLabel}
        </div>
      ) : (
        <ul
          data-tour={tourId}
          className={[
            "flex w-full flex-col items-center",
            anchor === "top" ? "justify-start" : "justify-end",
          ].join(" ")}
          style={{
            transform: scale === 1 ? undefined : `scale(${scale})`,
            transformOrigin: anchor === "top" ? "top center" : "bottom center",
          }}
        >
          {cards.map((entry, index) => {
            const catalog = resolveCard(entry.cardId);
            return (
              <li
                key={entry.instanceId}
                data-stack-card
                className="relative hover:z-30"
                style={{
                  marginTop: index === 0 ? 0 : -overlap,
                  zIndex: index + 1,
                }}
              >
                <CardView
                  name={catalog.name}
                  art={catalog.art}
                  faceUp={entry.faceUp}
                  size="board"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
