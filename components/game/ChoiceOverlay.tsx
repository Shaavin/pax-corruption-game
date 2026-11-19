"use client";

import { useState, type ReactNode } from "react";
import { PeekableOverlay } from "./PeekableOverlay";
import { CardView } from "./CardView";
import { DISTRICT_LABEL } from "./Lane";
import { getCard } from "@/lib/cards/catalog";
import { CardKind, DISTRICTS, District, type DistrictId } from "@/lib/cards/schema";
import { handLikeCards, landingDistrict, swapCandidates, type Action, type GameState, type PendingChoice, type PlayerId } from "@/lib/game";

type ChoiceOverlayProps = {
  state: GameState;
  choice: PendingChoice;
  viewer: PlayerId;
  onAction: (action: Action) => void;
};

/** Modal for the decision an ability is waiting on. */
export function ChoiceOverlay({ state, choice, viewer, onAction }: ChoiceOverlayProps) {
  switch (choice.kind) {
    case "discardOne":
      return (
        <Frame kicker="Currency Ballots" title="Discard a card" body="You drew a card. Now discard one card from your hand.">
          <CardRow
            cards={handLikeCards(state, viewer, { market: false }).map((card) => card.cardId)}
            ids={handLikeCards(state, viewer, { market: false }).map((card) => card.instanceId)}
            label={(name) => `Discard ${name}`}
            onPick={(instanceId) => onAction({ type: "chooseDiscard", player: viewer, instanceId })}
          />
        </Frame>
      );
    case "swapCivils":
      return <SwapChoice state={state} viewer={viewer} onAction={onAction} />;
    case "intelNetwork": {
      const cards = choice.instanceIds.map((id) => state.deck.find((card) => card.instanceId === id)!).filter(Boolean);
      return (
        <Frame
          kicker="Intel Network"
          title="Pick a card for the top of the deck"
          body="These are the top cards of the draw deck, top first. Only you can see them."
        >
          <CardRow
            cards={cards.map((card) => card.cardId)}
            ids={cards.map((card) => card.instanceId)}
            label={(name) => `Put ${name} on top`}
            onPick={(instanceId) => onAction({ type: "chooseIntel", player: viewer, instanceId })}
          />
        </Frame>
      );
    }
    case "peoplesPress": {
      const pile = state.players[viewer].support[District.Smarbbit];
      return (
        <Frame
          kicker="People's Press"
          title="Draw from where?"
          body="Draw from the deck as usual, or take a card back from your Smarbbit support pile."
        >
          <CardRow
            cards={pile.map((card) => card.cardId)}
            ids={pile.map((card) => card.instanceId)}
            label={(name) => `Take ${name}`}
            onPick={(instanceId) => onAction({ type: "choosePress", player: viewer, instanceId })}
          />
          <PrimaryButton onClick={() => onAction({ type: "choosePress", player: viewer, instanceId: null })}>
            Draw from the deck
          </PrimaryButton>
        </Frame>
      );
    }
    case "routeDiscards":
      return <RouteChoice state={state} choice={choice} viewer={viewer} onAction={onAction} />;
    case "trimAlliances":
      return <TrimChoice state={state} choice={choice} viewer={viewer} onAction={onAction} />;
  }
}

/** Alliance limit lowered (Martial Law): pick which of your alliances in the lane to discard. */
function TrimChoice({
  state,
  choice,
  viewer,
  onAction,
}: {
  state: GameState;
  choice: Extract<PendingChoice, { kind: "trimAlliances" }>;
  viewer: PlayerId;
  onAction: (action: Action) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const alliances = state.players[viewer].tableau[choice.district].filter(
    (card) => getCard(card.cardId).kind === CardKind.Alliance,
  );
  const name = DISTRICT_LABEL[choice.district];
  const many = choice.count === 1 ? "one" : String(choice.count);
  return (
    <Frame
      kicker="Alliance limit"
      title={`Discard ${many} ${name} ${choice.count === 1 ? "alliance" : "alliances"}`}
      body={`Your alliance limit in ${name} went down (Martial Law), so you have more alliances there than you may keep. Pick which to discard to your support pile.`}
    >
      <div className="flex flex-wrap justify-center gap-2">
        {alliances.map((card) => {
          const def = getCard(card.cardId);
          const on = picked.includes(card.instanceId);
          return (
            <button
              key={card.instanceId}
              type="button"
              aria-pressed={on}
              aria-label={`Discard ${def.name}`}
              onClick={() =>
                setPicked((list) =>
                  on ? list.filter((id) => id !== card.instanceId) : [...list, card.instanceId].slice(-choice.count),
                )
              }
              className={[
                "cursor-pointer rounded-xl p-1 transition",
                on ? "ring-2 ring-[var(--act)]" : "opacity-80 hover:opacity-100",
              ].join(" ")}
            >
              <CardView name={def.name} art={def.art} size="panel" cardId={card.cardId} />
            </button>
          );
        })}
      </div>
      <PrimaryButton
        disabled={picked.length !== choice.count}
        onClick={() => onAction({ type: "trimAlliances", player: viewer, instanceIds: picked })}
      >
        {choice.count === 1 ? "Discard it" : "Discard them"}
      </PrimaryButton>
    </Frame>
  );
}

function SwapChoice({ state, viewer, onAction }: { state: GameState; viewer: PlayerId; onAction: (action: Action) => void }) {
  const { mine, theirs } = swapCandidates(state, viewer);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  return (
    <Frame
      kicker="Urban Aristocrats"
      title="Swap a Dragonara civil?"
      body="Pick one of your Dragonara civil cards and one of theirs. They change owners."
    >
      <div className="flex flex-col gap-3">
        <PickRow title="Yours" cards={mine.map((c) => [c.instanceId, c.cardId])} selected={a} onPick={setA} />
        <PickRow title="Theirs" cards={theirs.map((c) => [c.instanceId, c.cardId])} selected={b} onPick={setB} />
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <GhostButton onClick={() => onAction({ type: "chooseSwap", player: viewer, swap: null })}>Don&apos;t swap</GhostButton>
        <PrimaryButton
          disabled={!a || !b}
          onClick={() => a && b && onAction({ type: "chooseSwap", player: viewer, swap: { mine: a, theirs: b } })}
        >
          Swap
        </PrimaryButton>
      </div>
    </Frame>
  );
}

function RouteChoice({
  state,
  choice,
  viewer,
  onAction,
}: {
  state: GameState;
  choice: Extract<PendingChoice, { kind: "routeDiscards" }>;
  viewer: PlayerId;
  onAction: (action: Action) => void;
}) {
  const [moves, setMoves] = useState<Record<string, DistrictId>>({});
  const cards = choice.instanceIds
    .map((id) => {
      for (const owner of [0, 1] as const) {
        for (const district of DISTRICTS) {
          const card = state.players[owner].support[district].find((entry) => entry.instanceId === id);
          if (card) return { card, district: landingDistrict(card) };
        }
      }
      return null;
    })
    .filter((entry) => entry !== null);

  return (
    <Frame
      kicker="Space Academy"
      title="Move a discard?"
      body="You may send one of the cards you just discarded to another of your support piles."
    >
      <ul className="flex flex-col gap-2">
        {cards.map(({ card, district }) => {
          const def = getCard(card.cardId);
          return (
            <li key={card.instanceId} className="flex items-center gap-3">
              <CardView name={def.name} art={def.art} size="mini" cardId={card.cardId} />
              <div className="flex flex-wrap gap-1">
                {DISTRICTS.filter((target) => target !== district).map((target) => {
                  const chosen = moves[card.instanceId] === target;
                  return (
                    <button
                      key={target}
                      type="button"
                      // One card per discard: picking a new move replaces the old one.
                      onClick={() => setMoves(chosen ? {} : { [card.instanceId]: target })}
                      className={[
                        "cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-30",
                        chosen ? "bg-[var(--act)] text-stone-950" : "bg-white/8 text-stone-200 hover:bg-white/14",
                      ].join(" ")}
                    >
                      → {DISTRICT_LABEL[target]}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-center gap-2">
        <GhostButton onClick={() => onAction({ type: "routeDiscards", player: viewer, moves: [] })}>Keep them where they are</GhostButton>
        <PrimaryButton
          disabled={Object.keys(moves).length === 0}
          onClick={() =>
            onAction({
              type: "routeDiscards",
              player: viewer,
              moves: Object.entries(moves).map(([instanceId, district]) => ({ instanceId, district })),
            })
          }
        >
          Move it
        </PrimaryButton>
      </div>
    </Frame>
  );
}

function Frame({ kicker, title, body, children }: { kicker: string; title: string; body: string; children: ReactNode }) {
  return (
    <PeekableOverlay
      label={`${kicker}: ${title}`}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/60 px-4"
    >
      <div className="rise-in glass-strong pointer-events-auto max-h-[90dvh] max-w-3xl overflow-y-auto rounded-2xl px-5 py-5 text-center shadow-2xl">
        <p className="label !text-[var(--act)]">{kicker}</p>
        <h2 className="mt-1.5 text-xl font-semibold text-stone-100">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-lg text-sm leading-relaxed text-stone-300">{body}</p>
        <div className="mt-4 flex flex-col items-center gap-3">{children}</div>
      </div>
    </PeekableOverlay>
  );
}

function CardRow({
  cards,
  ids,
  label,
  onPick,
}: {
  cards: string[];
  ids: string[];
  label: (name: string) => string;
  onPick: (instanceId: string) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {cards.map((cardId, index) => {
        const def = getCard(cardId);
        return (
          <CardView
            key={ids[index]}
            name={def.name}
            art={def.art}
            size="choice"
            cardId={cardId}
            playable
            selectLabel={label(def.name)}
            onSelect={() => onPick(ids[index]!)}
          />
        );
      })}
    </div>
  );
}

function PickRow({
  title,
  cards,
  selected,
  onPick,
}: {
  title: string;
  cards: [string, string][];
  selected: string | null;
  onPick: (instanceId: string) => void;
}) {
  return (
    <div>
      <p className="label mb-1">{title}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {cards.map(([instanceId, cardId]) => {
          const def = getCard(cardId);
          return (
            <CardView
              key={instanceId}
              name={def.name}
              art={def.art}
              size="related"
              cardId={cardId}
              playable={selected !== instanceId}
              selected={selected === instanceId}
              selectLabel={`Choose ${def.name}`}
              onSelect={() => onPick(instanceId)}
            />
          );
        })}
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
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

function GhostButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-stone-300 ring-1 ring-white/15 hover:bg-white/8"
    >
      {children}
    </button>
  );
}
