"use client";

import { useState, type ReactNode } from "react";
import { CardView } from "./CardView";
import { playerLabel } from "./players";
import { getCard, getParty } from "@/lib/cards/catalog";
import type { PartyIdValue } from "@/lib/cards/schema";
import {
  otherPlayer,
  Phase,
  SetupStep,
  type Action,
  type GameState,
  type PlayerId,
} from "@/lib/game";

type SetupOverlayProps = {
  state: GameState;
  viewer: PlayerId;
  onAction: (action: Action) => void;
};

export function SetupOverlay({ state, viewer, onAction }: SetupOverlayProps) {
  if (state.phase !== Phase.Setup || !state.setup || state.activePlayer !== viewer) {
    return null;
  }

  if (state.setup.step === SetupStep.ChooseParty) {
    return (
      <PartyChoice
        dealt={state.setup.dealtParties[viewer]}
        viewer={viewer}
        onAction={onAction}
      />
    );
  }

  return (
    <StartingHandChoice state={state} viewer={viewer} onAction={onAction} />
  );
}

function PartyChoice({
  dealt,
  viewer,
  onAction,
}: {
  dealt: readonly PartyIdValue[];
  viewer: PlayerId;
  onAction: (action: Action) => void;
}) {
  return (
    <ChoiceFrame
      kicker="Setup · parties"
      title={`${playerLabel(viewer)}, choose your party`}
      body={
        viewer === 0
          ? "Pick one, then choose your starting cards. Player 2 chooses a party after you."
          : "Pick one. You get all 4 of your listed starting cards."
      }
    >
      <div className="flex flex-wrap items-end justify-center gap-4">
        {dealt.map((partyId) => {
          const party = getParty(partyId);
          return (
            <div key={partyId} className="flex flex-col items-center gap-2">
              <CardView
                name={party.name}
                art={party.art}
                size="choice"
                cardId={partyId}
                selectLabel={`Choose ${party.name}`}
                onSelect={() =>
                  onAction({ type: "chooseParty", player: viewer, partyId })
                }
              />
              <div className="text-center leading-tight">
                <div className="text-sm font-semibold text-stone-100">
                  {party.name}
                </div>
                <div className="text-[0.65rem] tracking-[0.14em] text-stone-400 uppercase">
                  Order {party.order}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ChoiceFrame>
  );
}

function StartingHandChoice({
  state,
  viewer,
  onAction,
}: {
  state: GameState;
  viewer: PlayerId;
  onAction: (action: Action) => void;
}) {
  const offer = state.setup!.startingOffers[viewer];
  const [leaveId, setLeaveId] = useState<string | null>(null);
  const second = otherPlayer(viewer);

  function confirm() {
    if (!leaveId) return;
    onAction({
      type: "chooseStartingHand",
      player: viewer,
      instanceIds: offer
        .filter((card) => card.instanceId !== leaveId)
        .map((card) => card.instanceId),
    });
  }

  return (
    <ChoiceFrame
      kicker="Setup · starting cards"
      title={`${playerLabel(viewer)} takes 3 of 4`}
      body={`${playerLabel(viewer)} takes 3 of 4 starting cards. ${playerLabel(second)} gets all 4. Leave one of yours in the deck.`}
    >
      <div className="flex flex-wrap items-end justify-center gap-3">
        {offer.map((entry) => {
          const catalog = getCard(entry.cardId);
          const selected = leaveId === entry.instanceId;
          return (
            <div key={entry.instanceId} className="flex flex-col items-center gap-2">
              <CardView
                name={catalog.name}
                art={catalog.art}
                size="choice"
                dimmed={selected}
                selected={selected}
                selectLabel={`Leave ${catalog.name} in the deck`}
                onSelect={() =>
                  setLeaveId((current) =>
                    current === entry.instanceId ? null : entry.instanceId,
                  )
                }
              />
              <div className="max-w-[10rem] text-center leading-tight">
                <div className="text-xs font-medium text-stone-200">
                  {catalog.name}
                </div>
                {selected ? (
                  <div className="mt-0.5 text-[0.65rem] font-semibold tracking-[0.08em] text-stone-400 uppercase">
                    Stays in the deck
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-6 cursor-pointer rounded-full bg-[var(--brass)] px-6 py-2.5 text-sm font-semibold text-stone-950 hover:bg-[#d4b57c] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={leaveId === null}
        onClick={confirm}
      >
        Leave this in the deck
      </button>
    </ChoiceFrame>
  );
}

function ChoiceFrame({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="pointer-events-auto max-h-[min(92dvh,52rem)] w-full max-w-3xl overflow-y-auto rounded-xl bg-[#221c16] px-5 py-6 text-center shadow-2xl ring-1 ring-white/10">
        <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--brass)] uppercase">
          {kicker}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-100">{title}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-stone-300">
          {body}
        </p>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
