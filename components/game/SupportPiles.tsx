"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { CardView } from "./CardView";
import { PeekableOverlay } from "./PeekableOverlay";
import { resolveCard } from "./layout-fixture";
import type { DistrictId } from "@/lib/cards/schema";
import type { CardInstance } from "@/lib/game/types";

const DISTRICT_NAME: Record<DistrictId, string> = {
  dragonara: "Dragonara",
  horsard: "Horsard",
  shavvinne: "Shavvinne",
  smarbbit: "Smarbbit",
};

type SupportPilesProps = {
  districtOrder: readonly DistrictId[];
  you: Record<DistrictId, CardInstance[]>;
  opponent: Record<DistrictId, CardInstance[]>;
  /** West "support remains at zero": the event's name per district, if any. */
  zeroedBy: Record<DistrictId, string | null>;
  /** Scrolls to and outlines this district (opened from its plate). */
  focus: DistrictId | null;
  onClose: () => void;
};

/**
 * Support piles are public (rulebook): every card in both players' piles, district by
 * district, oldest first. Cards zoom on hover or long-press, like the policy chooser.
 */
export function SupportPiles({ districtOrder, you, opponent, zeroedBy, focus, onClose }: SupportPilesProps) {
  const focusRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "nearest" });
  }, [focus]);

  return (
    <PeekableOverlay
      label="Support piles"
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/65 px-3"
      onBackdropClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-piles-title"
        className="rise-in glass-strong max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl px-4 py-4 shadow-2xl sm:px-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="support-piles-title" className="text-lg font-semibold text-stone-100">
              Support piles
            </h2>
            <p className="mt-0.5 text-xs text-stone-400">
              Every discarded card, both players, district by district. Each card is 1 influence there and counts
              toward Popularity.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mt-1 -mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-lg text-stone-400 hover:bg-white/8 hover:text-stone-100"
          >
            ×
          </button>
        </div>
        <ul className="mt-3 flex flex-col gap-2.5">
          {districtOrder.map((district) => {
            const focused = focus === district;
            return (
              <li
                key={district}
                ref={focused ? focusRef : undefined}
                className={[
                  "rounded-xl bg-white/[0.035] px-3 py-2.5",
                  focused ? "ring-1 ring-[var(--act)]/70" : "",
                ].join(" ")}
                style={{ "--lane": `var(--${district})` } as CSSProperties}
              >
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-100">
                  <span aria-hidden className="h-3 w-1 rounded-full" style={{ background: `var(--${district})` }} />
                  {DISTRICT_NAME[district]}
                  <span className="text-xs font-normal text-stone-400 tabular-nums">
                    Opponent {opponent[district].length} · You {you[district].length}
                  </span>
                  {zeroedBy[district] ? (
                    <span className="ml-auto text-[0.65rem] font-normal text-[var(--ember)]">
                      {zeroedBy[district]}: counts as 0 for both
                    </span>
                  ) : null}
                </h3>
                <Pile label="Opponent" color="var(--opp)" cards={opponent[district]} />
                <Pile label="You" color="var(--you)" cards={you[district]} />
              </li>
            );
          })}
        </ul>
      </div>
    </PeekableOverlay>
  );
}

function Pile({ label, color, cards }: { label: string; color: string; cards: CardInstance[] }) {
  return (
    <div className="mt-2 flex items-start gap-2">
      <span className="w-16 shrink-0 pt-1 text-[0.65rem] font-semibold tracking-wide uppercase" style={{ color }}>
        {label}
      </span>
      {cards.length === 0 ? (
        <span className="pt-1 text-xs text-stone-500">Empty</span>
      ) : (
        <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label={`${label}: ${cards.length} cards`}>
          {cards.map((card) => {
            const def = resolveCard(card.cardId);
            return (
              <li key={card.instanceId}>
                <CardView name={def.name} art={def.art} size="panel" cardId={card.cardId} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
