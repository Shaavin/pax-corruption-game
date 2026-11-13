"use client";

import type { ReactNode } from "react";
import { CardBack, CardView } from "./CardView";
import type { PeekCard } from "./peek";
import {
  getCard,
  partyRelatedCards,
  PARTIES,
} from "@/lib/cards/catalog";
import { CardKind, type PartyCard } from "@/lib/cards/schema";

export function ZoomPreview({ card }: { card: PeekCard | null }) {
  if (!card) return null;
  // Phones: just the card; a party's starting cards and monument don't fit beside it.
  const small = typeof window !== "undefined" && window.innerWidth < 768;
  const party = small ? null : resolvePeekParty(card);
  const related = party ? partyRelatedCards(party) : null;
  const contents = card.contents ?? [];

  // Open on the half of the screen away from the hovered card, so it is never covered.
  // Phones: always centered (there's no room beside the card).
  const side =
    card.anchorX === undefined || typeof window === "undefined" || window.innerWidth < 768
      ? "center"
      : card.anchorX > window.innerWidth / 2
        ? "left"
        : "right";
  const placement =
    side === "left"
      ? "justify-start pl-[5rem]"
      : side === "right"
        ? "justify-end pr-[5rem]"
        : "justify-center";

  return (
    <div className={`pointer-events-none fixed inset-0 z-50 flex items-center p-4 ${placement}`}>
      <div className="rise-in glass-strong flex max-w-[min(70vw,64rem)] flex-wrap items-center justify-center gap-4 rounded-2xl p-3 shadow-[0_24px_70px_rgba(0,0,0,0.7)]">
        {contents.length === 0 ? (
          <CardView
            name={card.name}
            art={card.art}
            size="zoom"
            cardId={card.cardId}
            square={isDecree(card)}
          />
        ) : null}
        {contents.length > 0 ? (
          <RelatedGroup label={card.contentsLabel ?? card.name}>
            {contents.map((entry, index) => (
              <CardView
                key={entry.cardId ?? `${entry.art}-${index}`}
                name={entry.name}
                art={entry.art}
                size="related"
                back={CardBack.common}
              />
            ))}
          </RelatedGroup>
        ) : null}
        {related ? (
          <div className="flex flex-wrap items-start justify-center gap-3">
            <RelatedGroup label="Starting cards" columns={2}>
              {related.starting.map((entry) => (
                <CardView
                  key={entry.id}
                  name={entry.name}
                  art={entry.art}
                  size="related"
                  back={CardBack.common}
                />
              ))}
            </RelatedGroup>
            <RelatedGroup label="Monument">
              <CardView
                name={related.monument.name}
                art={related.monument.art}
                size="relatedMonument"
                back={CardBack.monument}
              />
            </RelatedGroup>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RelatedGroup({
  label,
  columns = 1,
  children,
}: {
  label: string;
  columns?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="label">
        {label}
      </div>
      <div
        className={
          columns === 2
            ? "grid grid-cols-2 gap-1.5"
            : "flex flex-wrap justify-center gap-1.5"
        }
      >
        {children}
      </div>
    </div>
  );
}

function isDecree(card: PeekCard): boolean {
  if (!card.cardId) return false;
  try {
    return getCard(card.cardId).kind === CardKind.Decree;
  } catch {
    return false;
  }
}

function resolvePeekParty(card: PeekCard): PartyCard | null {
  if (card.cardId) {
    try {
      const catalog = getCard(card.cardId);
      return catalog.kind === CardKind.Party ? catalog : null;
    } catch {
      return null;
    }
  }
  return PARTIES.find((party) => party.art === card.art) ?? null;
}
