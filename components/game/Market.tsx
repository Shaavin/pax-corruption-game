"use client";

import type { ReactNode } from "react";
import { CardBack, CardView } from "./CardView";
import { resolveCard, type FixtureCard } from "./layout-fixture";

type MarketProps = {
  market: FixtureCard[];
  monuments: FixtureCard[];
  deckCount: number;
  takeableIds?: ReadonlySet<string>;
  onTake?: (instanceId: string) => void;
};

export function Market({
  market,
  monuments,
  deckCount,
  takeableIds,
  onTake,
}: MarketProps) {
  return (
    <section
      data-tour="market"
      className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-y border-white/8 bg-black/25 px-3 py-1.5"
      aria-label="Shared market"
    >
      <div className="flex min-w-0 items-center overflow-x-auto">
        <Rail label="Monuments">
          {monuments.map((entry) => {
            const catalog = resolveCard(entry.cardId);
            return (
              <CardView
                key={entry.instanceId}
                name={catalog.name}
                art={catalog.art}
                faceUp={entry.faceUp}
                back={CardBack.monument}
                size="mini"
              />
            );
          })}
        </Rail>
      </div>

      <Rail label="Market">
        {market.map((entry) => {
          const catalog = resolveCard(entry.cardId);
          const takeable = takeableIds?.has(entry.instanceId) ?? false;
          return (
            <CardView
              key={entry.instanceId}
              name={catalog.name}
              art={catalog.art}
              faceUp={entry.faceUp}
              size="market"
              playable={takeable}
              selectLabel={takeable ? `Take ${catalog.name}` : undefined}
              onSelect={takeable && onTake ? () => onTake(entry.instanceId) : undefined}
            />
          );
        })}
      </Rail>

      <div className="flex items-center justify-end gap-2">
        <CardView
          name="Draw deck"
          art={CardBack.common}
          faceUp={false}
          size="mini"
        />
        <div className="text-right leading-tight">
          <div className="text-[0.6rem] font-semibold tracking-[0.16em] text-stone-400 uppercase">
            Deck
          </div>
          <div className="text-lg font-semibold tabular-nums text-stone-100">
            {deckCount}
          </div>
        </div>
      </div>
    </section>
  );
}

function Rail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-[0.6rem] font-semibold tracking-[0.16em] text-stone-400 uppercase">
        {label}
      </span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}
