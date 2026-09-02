"use client";

import { useMemo, useState } from "react";
import { PassDeviceGate } from "./PassDeviceGate";
import { playerLabel } from "./players";
import { SetupOverlay } from "./SetupOverlay";
import { Table } from "./Table";
import { tableModel } from "./table-model";
import {
  apply,
  createGame,
  createSeededRng,
  otherPlayer,
  Phase,
  SetupStep,
  type Action,
  type GameState,
  type PlayerId,
  type Rng,
} from "@/lib/game";

type Session = {
  seed: number;
  rng: Rng;
  state: GameState;
};

export function HotseatSession({ seed }: { seed: number }) {
  const [session, setSession] = useState<Session>(() => startSession(seed));
  const [seated, setSeated] = useState<PlayerId | null>(null);

  const { state } = session;
  const veiled = seated !== state.activePlayer;
  const viewer: PlayerId = seated ?? 0;
  const model = useMemo(() => tableModel(state, viewer), [state, viewer]);
  const inSetup = state.phase === Phase.Setup;

  function dispatch(action: Action) {
    const result = apply(session.state, action, session.rng);
    setSession({ ...session, state: result.state });
  }

  return (
    <Table
      model={model}
      seed={session.seed}
      status={statusLine(state)}
      showTour={!veiled && !inSetup}
      veiled={veiled}
      hotseat={viewer}
    >
      {veiled ? null : (
        <SetupOverlay state={state} viewer={viewer} onAction={dispatch} />
      )}
      {veiled ? (
        <PassDeviceGate
          to={state.activePlayer}
          firstHandoff={seated === null}
          hint={gateHint(state)}
          onConfirm={() => setSeated(state.activePlayer)}
        />
      ) : null}
    </Table>
  );
}

function startSession(seed: number): Session {
  const rng = createSeededRng(seed);
  return { seed, rng, state: createGame(rng, { seed }) };
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
  return state.phase;
}

function gateHint(state: GameState): string {
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
  if (state.phase === Phase.Action) {
    return "Setup is complete. It is your turn — your hand is face-up, theirs is hidden.";
  }
  return "Keep this screen to yourself until you confirm.";
}
