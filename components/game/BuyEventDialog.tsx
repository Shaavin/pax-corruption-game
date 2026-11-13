"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CardView } from "./CardView";
import { getCard } from "@/lib/cards/catalog";
import { getEvent, VICTORY_CARDS, WORLD_POWER_NAME } from "@/lib/cards/expansion";
import { District } from "@/lib/cards/schema";
import {
  eventCost,
  eventUses,
  handLikeCards,
  martialLawBlocks,
  type Action,
  type EventUse,
  type GameState,
  type PlayerId,
} from "@/lib/game";

const POWER_LABEL = { north: "North", south: "South", east: "East", west: "West" } as const;

type BuyEventDialogProps = {
  state: GameState;
  viewer: PlayerId;
  instanceId: string;
  onAction: (action: Action) => void;
  onClose: () => void;
};

/**
 * Legacy & Diplomacy income option B: pay one card per non-event card to the
 * event's right, then play it at once (effect or civil; legacy: discard or activate).
 */
export function BuyEventDialog({ state, viewer, instanceId, onAction, onClose }: BuyEventDialogProps) {
  const card = state.market.find((entry) => entry.instanceId === instanceId)!;
  const event = getEvent(card.cardId);
  const cost = eventCost(state, instanceId);
  const purse = handLikeCards(state, viewer, { market: false });
  const [pay, setPay] = useState<string[]>(() => (cost >= purse.length ? purse.map((entry) => entry.instanceId) : []));
  const uses = eventUses(state, card.cardId);
  const ready = pay.length === cost;
  const shavvinnePaid = pay.filter((id) => {
    const def = getCard(purse.find((entry) => entry.instanceId === id)!.cardId);
    return "district" in def && def.district === District.Shavvinne;
  }).length;
  const martial = martialLawBlocks(state, Array(shavvinnePaid).fill(District.Shavvinne));

  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(id: string) {
    setPay((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : current.length < cost ? [...current, id] : current,
    );
  }

  function buy(use: EventUse, victory?: (typeof uses)[number]["victory"]) {
    onAction({ type: "buyEvent", player: viewer, instanceId, payIds: pay, use, ...(victory ? { victory } : {}) });
  }

  return (
    <div className="absolute inset-0 z-[45] flex items-center justify-center bg-black/65 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-event-title"
        className="rise-in glass-strong max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl px-5 py-5 shadow-2xl"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="flex flex-wrap items-start gap-5">
          <CardView name={event.name} art={event.art} size="choice" cardId={card.cardId} />
          <div className="min-w-0 flex-1">
            <p className="label !text-[var(--act)]">
              Buy an event · {WORLD_POWER_NAME[event.power]}
            </p>
            <h2 id="buy-event-title" className="mt-1 text-xl font-semibold text-stone-100">
              {event.name}
            </h2>
            <p className="mt-1 text-sm text-stone-300">{event.text}</p>
            <p className="mt-2 text-sm text-stone-400">
              Costs <span className="font-semibold text-stone-100">{cost}</span> card{cost === 1 ? "" : "s"} (one per
              non-event card to its right). Paid cards go to your support piles. +1 {POWER_LABEL[event.power]} relation.
            </p>
          </div>
        </div>

        {cost > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">
              Pay {pay.length}/{cost}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {purse.map((entry) => {
                const def = getCard(entry.cardId);
                const chosen = pay.includes(entry.instanceId);
                return (
                  <CardView
                    key={entry.instanceId}
                    name={def.name}
                    art={def.art}
                    size="market"
                    cardId={entry.cardId}
                    selected={chosen}
                    playable={chosen || pay.length < cost}
                    selectLabel={`${chosen ? "Keep" : "Pay with"} ${def.name}`}
                    onSelect={() => toggle(entry.instanceId)}
                  />
                );
              })}
            </div>
            {martial ? (
              <p className="mt-2 text-sm text-red-300">Martial Law: you can&apos;t discard 2 or more Shavvinne cards at once.</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {event.legacy ? (
            <>
              <UseButton disabled={!ready || martial} onClick={() => buy("legacyDiscard")}>
                Discard all played {POWER_LABEL[event.power]} cards
              </UseButton>
              {uses
                .filter((entry) => entry.use === "legacyActivate")
                .map((entry) => {
                  const victory = VICTORY_CARDS.find((card) => card.id === entry.victory)!;
                  return (
                    <UseButton key={entry.victory} disabled={!ready || martial} onClick={() => buy("legacyActivate", entry.victory)}>
                      Activate {victory.name} Victory
                    </UseButton>
                  );
                })}
            </>
          ) : (
            <>
              <UseButton disabled={!ready || martial} onClick={() => buy("effect")}>
                Play for its effect · draw a card
              </UseButton>
              <UseButton disabled={!ready || martial} onClick={() => buy("civil")}>
                Play as a civil card: {event.civilName} ({event.influence}) in {districtName(event.district)}
              </UseButton>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-stone-300 ring-1 ring-white/15 hover:bg-white/8"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function districtName(district: string): string {
  return district.charAt(0).toUpperCase() + district.slice(1);
}

function UseButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="cursor-pointer rounded-xl bg-[var(--act)] px-4 py-2 text-sm font-semibold text-stone-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
