"use client";

import { CardView } from "./CardView";
import type { PeekCard } from "./peek";

export function ZoomPreview({ card }: { card: PeekCard | null }) {
  if (!card) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="rounded-md bg-black/35 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/10 backdrop-blur-[2px]">
        <CardView name={card.name} art={card.art} size="zoom" />
      </div>
    </div>
  );
}
