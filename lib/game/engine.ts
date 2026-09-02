import { getCard } from "../cards/catalog.ts";
import { CardKind, type PartyIdValue } from "../cards/schema.ts";
import {
  afterMainAction,
  beginIncome,
  takeMarketCard,
  underHandLimit,
} from "./income.ts";
import type { Rng } from "./rng.ts";
import {
  dealStartingOffer,
  finishSetup,
  revealParties,
  takeStartingHand,
} from "./setup.ts";
import {
  Phase,
  SetupStep,
  type Action,
  type ApplyResult,
  type ChoosePartyAction,
  type ChooseStartingHandAction,
  type EndActionAction,
  type GameEvent,
  type GameState,
  type PlayCivilAction,
  type PlayerId,
  type TakeMarketAction,
} from "./types.ts";
import { cloneState, sameIdSet, takeInstance } from "./zones.ts";

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
      return { state: next, events: applyChooseParty(next, action, rng) };
    case "chooseStartingHand":
      return {
        state: next,
        events: applyChooseStartingHand(next, action),
      };
    case "playCivil":
      return { state: next, events: applyPlayCivil(next, action) };
    case "endAction":
      return { state: next, events: applyEndAction(next, action) };
    case "takeMarket":
      return { state: next, events: applyTakeMarket(next, action) };
    default: {
      const never: never = action;
      throw new IllegalActionError(`Unknown action ${(never as Action).type}`);
    }
  }
}

export function legalActions(state: GameState, viewer: PlayerId): Action[] {
  if (state.activePlayer !== viewer) return [];

  if (state.phase === Phase.Setup && state.setup) {
    if (state.setup.step === SetupStep.ChooseParty) {
      return state.setup.dealtParties[viewer].map((partyId) => ({
        type: "chooseParty" as const,
        player: viewer,
        partyId,
      }));
    }

    const offer = state.setup.startingOffers[viewer];
    return offer.map((_, omit) => ({
      type: "chooseStartingHand" as const,
      player: viewer,
      instanceIds: offer
        .filter((_, index) => index !== omit)
        .map((card) => card.instanceId),
    }));
  }

  if (state.phase === Phase.Action) {
    const civils = civilInHand(state, viewer);
    if (civils.length > 0) {
      return civils.map((card) => ({
        type: "playCivil" as const,
        player: viewer,
        instanceId: card.instanceId,
      }));
    }
    return [{ type: "endAction" as const, player: viewer }];
  }

  if (state.phase === Phase.Income) {
    return state.market.map((card) => ({
      type: "takeMarket" as const,
      player: viewer,
      instanceId: card.instanceId,
    }));
  }

  return [];
}

export const checkVictory: (state: GameState) => PlayerId | null = () => null;

function applyChooseParty(
  state: GameState,
  action: ChoosePartyAction,
  rng: Rng,
): GameEvent[] {
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
    dealStartingOffer(state, 0);
    setup.step = SetupStep.ChooseStartingHand;
    return events;
  }

  dealStartingOffer(state, 1);
  events.push(
    takeStartingHand(
      state,
      1,
      setup.startingOffers[1].map((card) => card.instanceId),
    ),
  );
  events.push(...revealParties(state));
  events.push(...finishSetup(state, rng));
  return events;
}

function applyChooseStartingHand(
  state: GameState,
  action: ChooseStartingHandAction,
): GameEvent[] {
  const setup = requireSetup(state, SetupStep.ChooseStartingHand);
  if (action.player !== state.activePlayer) {
    throw new IllegalActionError("It is not this player's turn to take a starting hand");
  }
  if (action.player !== 0) {
    throw new IllegalActionError(
      "Player 2 is dealt all 4 listed starting cards automatically",
    );
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
  if (action.instanceIds.length !== 3) {
    throw new IllegalActionError(
      "Player 1 must take 3 of the 4 listed starting cards",
    );
  }

  const events: GameEvent[] = [
    takeStartingHand(state, action.player, action.instanceIds),
  ];
  setup.step = SetupStep.ChooseParty;
  state.activePlayer = 1;
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

function applyPlayCivil(state: GameState, action: PlayCivilAction): GameEvent[] {
  requirePhase(state, Phase.Action);
  requireActor(state, action.player);
  const seat = state.players[action.player];
  const inHand = seat.hand.some((card) => card.instanceId === action.instanceId);
  if (!inHand) {
    throw new IllegalActionError("That card is not in your hand");
  }
  const card = takeInstance(seat.hand, action.instanceId);
  const def = getCard(card.cardId);
  if (def.kind !== CardKind.Civil) {
    seat.hand.push(card);
    throw new IllegalActionError("Only civil cards can be played this way");
  }

  const played = {
    ...card,
    faceUp: true,
    occupiedDistrict: def.district,
  };
  seat.tableau[def.district].push(played);
  const events: GameEvent[] = [
    {
      type: "civilPlayed",
      player: action.player,
      instanceId: played.instanceId,
      cardId: played.cardId,
      district: def.district,
    },
  ];
  afterMainAction(state, events);
  return events;
}

function applyEndAction(state: GameState, action: EndActionAction): GameEvent[] {
  requirePhase(state, Phase.Action);
  requireActor(state, action.player);
  if (civilInHand(state, action.player).length > 0) {
    throw new IllegalActionError("Play a civil card before ending the action step");
  }
  const events: GameEvent[] = [];
  beginIncome(state, events);
  return events;
}

function applyTakeMarket(state: GameState, action: TakeMarketAction): GameEvent[] {
  requirePhase(state, Phase.Income);
  requireActor(state, action.player);
  if (!underHandLimit(state, action.player)) {
    throw new IllegalActionError("Hand is at the limit; you cannot take a market card");
  }
  if (!state.market.some((card) => card.instanceId === action.instanceId)) {
    throw new IllegalActionError("That card is not in the market");
  }
  const events: GameEvent[] = [];
  takeMarketCard(state, action.instanceId, events);
  return events;
}

function civilInHand(state: GameState, player: PlayerId) {
  return state.players[player].hand.filter(
    (card) => getCard(card.cardId).kind === CardKind.Civil,
  );
}

function requirePhase(state: GameState, phase: typeof Phase[keyof typeof Phase]) {
  if (state.phase !== phase) {
    throw new IllegalActionError(`Expected ${phase} phase, got ${state.phase}`);
  }
}

function requireActor(state: GameState, player: PlayerId) {
  if (player !== state.activePlayer) {
    throw new IllegalActionError("It is not this player's turn");
  }
}

function actionsEqual(a: Action, b: Action): boolean {
  if (a.type !== b.type || a.player !== b.player) return false;
  if (a.type === "chooseParty" && b.type === "chooseParty") {
    return a.partyId === b.partyId;
  }
  if (a.type === "chooseStartingHand" && b.type === "chooseStartingHand") {
    return sameIdSet(a.instanceIds, b.instanceIds);
  }
  if (a.type === "playCivil" && b.type === "playCivil") {
    return a.instanceId === b.instanceId;
  }
  if (a.type === "takeMarket" && b.type === "takeMarket") {
    return a.instanceId === b.instanceId;
  }
  if (a.type === "endAction" && b.type === "endAction") {
    return true;
  }
  return false;
}

export function chosenPartyId(
  state: GameState,
  player: PlayerId,
): PartyIdValue | null {
  return state.players[player].partyId ?? state.setup?.chosenParty[player] ?? null;
}
