import type { PartyIdValue } from "../cards/schema.ts";
import {
  finishSetup,
  revealParties,
  takeStartingHand,
} from "./setup.ts";
import type { Rng } from "./rng.ts";
import {
  Phase,
  SetupStep,
  type Action,
  type ApplyResult,
  type ChoosePartyAction,
  type ChooseStartingHandAction,
  type GameEvent,
  type GameState,
  type PlayerId,
} from "./types.ts";
import { cloneState, otherPlayer, sameIdSet } from "./zones.ts";

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalActionError";
  }
}

export function apply(state: GameState, action: Action, rng: Rng): ApplyResult {
  const next = cloneState(state);
  switch (action.type) {
    case "chooseParty":
      return { state: next, events: applyChooseParty(next, action) };
    case "chooseStartingHand":
      return {
        state: next,
        events: applyChooseStartingHand(next, action, rng),
      };
    default: {
      const never: never = action;
      throw new IllegalActionError(`Unknown action ${(never as Action).type}`);
    }
  }
}

export function legalActions(state: GameState, viewer: PlayerId): Action[] {
  if (state.activePlayer !== viewer) return [];
  if (state.phase !== Phase.Setup || !state.setup) return [];

  if (state.setup.step === SetupStep.ChooseParty) {
    return state.setup.dealtParties[viewer].map((partyId) => ({
      type: "chooseParty" as const,
      player: viewer,
      partyId,
    }));
  }

  const offer = state.setup.startingOffers[viewer];
  if (viewer === state.firstPlayer) {
    return offer.map((_, omit) => ({
      type: "chooseStartingHand" as const,
      player: viewer,
      instanceIds: offer
        .filter((_, index) => index !== omit)
        .map((card) => card.instanceId),
    }));
  }

  return [
    {
      type: "chooseStartingHand",
      player: viewer,
      instanceIds: offer.map((card) => card.instanceId),
    },
  ];
}

export function checkVictory(_state: GameState): PlayerId | null {
  return null;
}

function applyChooseParty(state: GameState, action: ChoosePartyAction): GameEvent[] {
  const setup = requireSetup(state, SetupStep.ChooseParty);
  if (action.player !== state.activePlayer) {
    throw new IllegalActionError("It is not this player's turn to choose a party");
  }
  if (setup.chosenParty[action.player]) {
    throw new IllegalActionError("This player already chose a party");
  }
  if (!setup.dealtParties[action.player].includes(action.partyId)) {
    throw new IllegalActionError("That party was not dealt to this player");
  }

  setup.chosenParty[action.player] = action.partyId;
  const events: GameEvent[] = [
    { type: "partyChosen", player: action.player, partyId: action.partyId },
  ];

  if (action.player === 0) {
    state.activePlayer = 1;
    return events;
  }

  events.push(...revealParties(state));
  return events;
}

function applyChooseStartingHand(
  state: GameState,
  action: ChooseStartingHandAction,
  rng: Rng,
): GameEvent[] {
  const setup = requireSetup(state, SetupStep.ChooseStartingHand);
  if (action.player !== state.activePlayer) {
    throw new IllegalActionError("It is not this player's turn to take a starting hand");
  }
  const firstPlayer = state.firstPlayer;
  if (firstPlayer === null) {
    throw new IllegalActionError("Starting hands require a first player");
  }

  const offer = setup.startingOffers[action.player];
  const offerIds = offer.map((card) => card.instanceId);
  const unique = new Set(action.instanceIds);
  if (unique.size !== action.instanceIds.length) {
    throw new IllegalActionError("Starting-hand picks must be unique");
  }
  if (action.instanceIds.some((id) => !offerIds.includes(id))) {
    throw new IllegalActionError("Starting-hand pick is not one of the listed cards");
  }

  const isFirst = action.player === firstPlayer;
  const expected = isFirst ? 3 : 4;
  if (action.instanceIds.length !== expected) {
    throw new IllegalActionError(
      isFirst
        ? "First player must take 3 of the 4 listed starting cards"
        : "Second player must take all 4 listed starting cards",
    );
  }
  if (!isFirst && !sameIdSet(action.instanceIds, offerIds)) {
    throw new IllegalActionError("Second player must take all 4 listed starting cards");
  }

  const events: GameEvent[] = [
    takeStartingHand(state, action.player, action.instanceIds),
  ];

  if (isFirst) {
    state.activePlayer = otherPlayer(action.player);
    return events;
  }

  events.push(...finishSetup(state, rng));
  return events;
}

function requireSetup(state: GameState, step: typeof SetupStep[keyof typeof SetupStep]) {
  if (state.phase !== Phase.Setup || !state.setup) {
    throw new IllegalActionError("The game is not in setup");
  }
  if (state.setup.step !== step) {
    throw new IllegalActionError(`Setup is on ${state.setup.step}, not ${step}`);
  }
  return state.setup;
}

export function isLegalAction(state: GameState, action: Action, viewer: PlayerId): boolean {
  return legalActions(state, viewer).some((legal) => actionsEqual(legal, action));
}

function actionsEqual(a: Action, b: Action): boolean {
  if (a.type !== b.type || a.player !== b.player) return false;
  if (a.type === "chooseParty" && b.type === "chooseParty") {
    return a.partyId === b.partyId;
  }
  if (a.type === "chooseStartingHand" && b.type === "chooseStartingHand") {
    return sameIdSet(a.instanceIds, b.instanceIds);
  }
  return false;
}

export function chosenPartyId(
  state: GameState,
  player: PlayerId,
): PartyIdValue | null {
  return state.players[player].partyId ?? state.setup?.chosenParty[player] ?? null;
}
