"use client";

import { useEffect, useMemo, useState } from "react";
import { PassDeviceGate } from "./PassDeviceGate";
import { playerLabel } from "./players";
import { SetupOverlay } from "./SetupOverlay";
import { Table } from "./Table";
import { tableModel } from "./table-model";
import { getCard } from "@/lib/cards/catalog";
import { CardKind, type DistrictId } from "@/lib/cards/schema";
import {
  apply,
  createGame,
  createSeededRng,
  legalActions,
  otherPlayer,
  Phase,
  SetupStep,
  type Action,
  type GameEvent,
  type GameState,
  type PlayerId,
  type Rng,
} from "@/lib/game";

type Session = {
  seed: number;
  rng: Rng;
  state: GameState;
  lastEvents: GameEvent[];
};

export function HotseatSession({ seed }: { seed: number }) {
  const [session, setSession] = useState<Session>(() => startSession(seed));
  const [seated, setSeated] = useState<PlayerId | null>(null);
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);

  const { state } = session;
  const veiled = seated !== state.activePlayer;
  const viewer: PlayerId = seated ?? 0;
  const model = useMemo(() => tableModel(state, viewer), [state, viewer]);
  const inSetup = state.phase === Phase.Setup;
  const legal = useMemo(
    () => (veiled ? [] : legalActions(state, viewer)),
    [state, veiled, viewer],
  );

  useEffect(() => {
    if (!selectedHandId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedHandId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedHandId]);

  function dispatch(action: Action) {
    const result = apply(session.state, action, session.rng);
    setSelectedHandId(null);
    const startOfTurn = action.type === "playCivil" || action.type === "endAction";
    setSession({
      ...session,
      state: result.state,
      lastEvents: startOfTurn
        ? result.events
        : [...session.lastEvents, ...result.events],
    });
  }

  const playableHandIds = useMemo(() => {
    const ids = new Set<string>();
    for (const action of legal) {
      if (action.type === "playCivil") ids.add(action.instanceId);
    }
    return ids;
  }, [legal]);

  const takeableMarketIds = useMemo(() => {
    const ids = new Set<string>();
    for (const action of legal) {
      if (action.type === "takeMarket") ids.add(action.instanceId);
    }
    return ids;
  }, [legal]);

  const selectedCard = selectedHandId
    ? state.players[viewer].hand.find((card) => card.instanceId === selectedHandId)
    : undefined;
  const selectedDef = selectedCard ? getCard(selectedCard.cardId) : null;
  const targetDistrict: DistrictId | null =
    selectedDef?.kind === CardKind.Civil ? selectedDef.district : null;
  const canEndAction = legal.some((action) => action.type === "endAction");

  const interaction =
    veiled || inSetup
      ? null
      : {
          playableHandIds,
          selectedHandId,
          onSelectHand: (instanceId: string) => {
            setSelectedHandId((current) =>
              current === instanceId ? null : instanceId,
            );
          },
          targetDistrict,
          onSelectDistrict: (district: DistrictId) => {
            if (!selectedHandId || targetDistrict !== district) return;
            dispatch({
              type: "playCivil",
              player: viewer,
              instanceId: selectedHandId,
            });
          },
          takeableMarketIds,
          onTakeMarket: (instanceId: string) => {
            dispatch({ type: "takeMarket", player: viewer, instanceId });
          },
          prompt: turnPrompt(state, selectedHandId, canEndAction),
          extraAction: canEndAction
            ? {
                label: "No civil to play — take income",
                onClick: () => dispatch({ type: "endAction", player: viewer }),
              }
            : undefined,
        };

  return (
    <Table
      model={model}
      seed={session.seed}
      status={statusLine(state)}
      showTour={!veiled && !inSetup}
      veiled={veiled}
      hotseat={viewer}
      interaction={interaction}
    >
      {veiled ? null : (
        <SetupOverlay state={state} viewer={viewer} onAction={dispatch} />
      )}
      {veiled ? (
        <PassDeviceGate
          to={state.activePlayer}
          firstHandoff={seated === null}
          hint={gateHint(state, session.lastEvents)}
          onConfirm={() => setSeated(state.activePlayer)}
        />
      ) : null}
    </Table>
  );
}

function startSession(seed: number): Session {
  const rng = createSeededRng(seed);
  return { seed, rng, state: createGame(rng, { seed }), lastEvents: [] };
}

function turnPrompt(
  state: GameState,
  selectedHandId: string | null,
  canEndAction: boolean,
): string {
  if (state.phase === Phase.Income) {
    return "Income · take one market card";
  }
  if (canEndAction) {
    return "Action · no civil in hand";
  }
  if (selectedHandId) {
    return "Action · play into the highlighted district";
  }
  return "Action · play a civil card from your hand";
}

function statusLine(state: GameState): string {
  if (state.phase === Phase.Setup && state.setup?.step === SetupStep.ChooseParty) {
    return "Setup · choose party";
  }
  if (
    state.phase === Phase.Setup &&
    state.setup?.step === SetupStep.ChooseStartingHand
  ) {
    return "Setup · starting cards";
  }
  if (state.phase === Phase.Action) {
    return "Action · your turn";
  }
  if (state.phase === Phase.Income) {
    return "Income · take a market card";
  }
  return state.phase;
}

function gateHint(state: GameState, events: GameEvent[]): string {
  if (state.phase === Phase.Setup && state.setup?.step === SetupStep.ChooseParty) {
    return state.activePlayer === 0
      ? "Choose one of the two parties dealt to you, then your starting cards."
      : "Choose one of the two parties dealt to you. You get all 4 listed starting cards.";
  }
  if (
    state.phase === Phase.Setup &&
    state.setup?.step === SetupStep.ChooseStartingHand
  ) {
    return `${playerLabel(state.activePlayer)} takes 3 of 4 starting cards. ${playerLabel(otherPlayer(state.activePlayer))} gets all 4.`;
  }

  const bits: string[] = [];
  const played = events.find((event) => event.type === "civilPlayed");
  if (played) {
    bits.push(`Played ${getCard(played.cardId).name}.`);
  }
  const taken = events.find((event) => event.type === "marketTaken");
  if (taken) {
    bits.push(`Took ${getCard(taken.cardId).name} from the market.`);
  }
  if (events.some((event) => event.type === "cardDrawn")) {
    bits.push("Drew from the deck.");
  }
  if (events.some((event) => event.type === "electionSetAside")) {
    bits.push("A general election was set aside.");
  }
  bits.push("Your turn is over. Pass the device.");
  return bits.join(" ");
}
