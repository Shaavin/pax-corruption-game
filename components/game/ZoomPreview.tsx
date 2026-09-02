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
  const party = resolvePeekParty(card);
  const related = party ? partyRelatedCards(party) : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="flex max-w-[min(96vw,68rem)] flex-wrap items-center justify-center gap-4 rounded-md bg-black/35 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/10 backdrop-blur-[2px]">
        <CardView name={card.name} art={card.art} size="zoom" />
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
      <div className="text-[0.6rem] font-semibold tracking-[0.14em] text-[var(--brass)] uppercase">
        {label}
      </div>
      <div className={columns === 2 ? "grid grid-cols-2 gap-1.5" : "flex gap-1.5"}>
        {children}
      </div>
    </div>
  );
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
