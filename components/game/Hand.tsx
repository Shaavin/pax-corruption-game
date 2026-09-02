"use client";

import { useState } from "react";
import { CardView } from "./CardView";
import { resolveCard, type FixtureCard } from "./layout-fixture";

type HandProps = {
  cards: FixtureCard[];
  faceUp: boolean;
  align?: "start" | "end";
  tourId?: string;
};

export function Hand({ cards, faceUp, align = "end", tourId }: HandProps) {
  const [hover, setHover] = useState<number | null>(null);

  return (
    <ul
      data-tour={tourId}
      className={[
        "flex min-w-0 flex-1 justify-center overflow-visible px-1",
        align === "start" ? "items-start" : "items-end",
      ].join(" ")}
    >
      {cards.map((entry, index) => {
        const catalog = resolveCard(entry.cardId);
        return (
          <li
            key={entry.instanceId}
            className="relative"
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
            style={{
              marginLeft: index === 0 ? 0 : "calc(var(--card-hand) * -0.42)",
              zIndex: hover === index ? 40 : index + 1,
            }}
          >
            <CardView
              name={catalog.name}
              art={catalog.art}
              faceUp={faceUp && entry.faceUp}
              size="hand"
            />
          </li>
        );
      })}
    </ul>
  );
}
