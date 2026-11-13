import { getCard } from "../cards/catalog.ts";
import { CardKind, DISTRICTS, type DistrictId, type PartyIdValue } from "../cards/schema.ts";
import { martialLawBlocks } from "./abilities.ts";
import { chooseDiscard, choiceActions, chooseIntel, choosePress, chooseSwap, routeDiscards } from "./choices.ts";
import { inactiveDecrees } from "./decrees.ts";
import { gameIsOver } from "./discard.ts";
import { activateDecree } from "./election.ts";
import { IllegalActionError, asIllegal } from "./errors.ts";
import { applyFreeAction, applySetAside, freeActions, hasFreeAction, setAsideActions } from "./free-actions.ts";
import { afterMainAction, completeIncome, proceed, setFreeActionCheck, takeMarketCard, underHandLimit } from "./income.ts";
import { applyBuyEvent, buyEventActions } from "./events.ts";
import { isEventCard } from "./world.ts";
import {
  CONSTRUCT_COST,
  RECRUIT_COST,
  canPlayAlliance,
  canRecruitIn,
  combinations,
  handCardsInDistrict,
  handLikeCards,
  printedDistrict,
} from "./main.ts";
import { construct, playBlockReason, playConspiracy, playToLane, proposePolicy, recruit, seatSenator } from "./plays.ts";
import type { Rng } from "./rng.ts";
import { policyTargets, revealPasses } from "./senate.ts";
import { dealStartingOffer, finishSetup, revealParties, takeStartingHand } from "./setup.ts";
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
import { declarableVictories, endGame, sameVictory } from "./victory.ts";
import { cloneState, sameIdSet } from "./zones.ts";

export { IllegalActionError };

// The turn flow (income.ts) asks whether a free action still remains after the main action.
setFreeActionCheck(hasFreeAction);

export function currentActor(state: GameState): PlayerId {
  return state.pending[0]?.player ?? state.activePlayer;
}

export function apply(state: GameState, action: Action, rng: Rng): ApplyResult {
  if (gameIsOver(state)) throw new IllegalActionError("The game is over");
  const next = cloneState(state);
  const events: GameEvent[] = [];
  if (next.pending.length > 0 && !isChoiceAction(action)) {
    throw new IllegalActionError("Resolve the pending choice first");
  }
  if (next.phase !== Phase.Setup && next.phase !== Phase.DecreeChoice && action.player !== currentActor(next)) {
    throw new IllegalActionError("It is not this player's turn");
  }

  switch (action.type) {
    case "chooseParty":
      events.push(...applyChooseParty(next, action));
      break;
    case "chooseStartingHand":
      events.push(...applyChooseStartingHand(next, action, rng));
      break;
    case "playCivil":
      requireMainAction(next);
      playToLane(next, action.player, action.instanceId, CardKind.Civil, events);
      afterMainAction(next, events);
      break;
    case "playAlliance":
      requireMainAction(next);
      playToLane(next, action.player, action.instanceId, CardKind.Alliance, events);
      afterMainAction(next, events);
      break;
    case "playConspiracy":
      requireMainAction(next);
      playConspiracy(next, action.player, action.instanceId, events);
      afterMainAction(next, events);
      break;
    case "recruit":
      requireMainAction(next);
      recruit(next, action.player, action.instanceIds, events);
      afterMainAction(next, events);
      break;
    case "construct":
      requireMainAction(next);
      construct(next, action.player, action.instanceIds, action.monumentInstanceId, CONSTRUCT_COST, rng, events);
      afterMainAction(next, events);
      break;
    case "endAction":
      requirePhase(next, Phase.Action);
      if (!next.turn.mainActionDone && mainActions(next, action.player).length > 0) {
        throw new IllegalActionError("A main action is still available");
      }
      next.turn.mainActionDone = true;
      proceed(next, "politics", events);
      break;
    case "freeAction":
      applyFreeAction(next, action, rng, events);
      break;
    case "setAside":
      applySetAside(next, action, events);
      break;
    case "influenceSenate":
      requirePhase(next, Phase.Politics);
      seatSenator(next, action.player, action.instanceId, events);
      proceed(next, "income", events);
      break;
    case "proposePolicy":
      requirePhase(next, Phase.Politics);
      proposePolicy(next, action.player, action.revealIds, action.discardId, action.district, action.policyId, events);
      proceed(next, "income", events);
      break;
    case "declareVictory": {
      requirePhase(next, Phase.Politics);
      const legal = declarableVictories(next, action.player).find((victory) => sameVictory(victory, action.victory));
      if (!legal) throw new IllegalActionError("That victory cannot be declared now");
      endGame(next, legal, events);
      break;
    }
    case "endPolitics":
      requirePhase(next, Phase.Politics);
      proceed(next, "income", events);
      break;
    case "takeMarket":
      requirePhase(next, Phase.Income);
      if (!underHandLimit(next, action.player)) {
        throw new IllegalActionError("Hand is at the limit; you cannot take a market card");
      }
      if (!next.market.some((card) => card.instanceId === action.instanceId && !isEventCard(card))) {
        throw new IllegalActionError("That card is not in the market");
      }
      takeMarketCard(next, action.instanceId, events);
      break;
    case "buyEvent":
      requirePhase(next, Phase.Income);
      applyBuyEvent(next, action, events);
      completeIncome(next, events);
      break;
    case "activateDecree":
      requirePhase(next, Phase.DecreeChoice);
      asIllegal(() => activateDecree(next, action.player, action.decreeId, events), "Illegal decree activation");
      break;
    case "chooseDiscard":
      chooseDiscard(next, action.player, action.instanceId, events);
      break;
    case "chooseSwap":
      chooseSwap(next, action.player, action.swap, events);
      break;
    case "chooseIntel":
      chooseIntel(next, action.player, action.instanceId, events);
      break;
    case "choosePress":
      choosePress(next, action.player, action.instanceId, events);
      break;
    case "routeDiscards":
      routeDiscards(next, action.player, action.moves, events);
      break;
    default: {
      const never: never = action;
      throw new IllegalActionError(`Unknown action ${(never as Action).type}`);
    }
  }
  return { state: next, events };
}

function isChoiceAction(action: Action): boolean {
  return (
    action.type === "chooseDiscard" ||
    action.type === "chooseSwap" ||
    action.type === "chooseIntel" ||
    action.type === "choosePress" ||
    action.type === "routeDiscards"
  );
}

function requireMainAction(state: GameState): void {
  requirePhase(state, Phase.Action);
  if (state.turn.mainActionDone) throw new IllegalActionError("You already took your main action this turn");
}

export function legalActions(state: GameState, viewer: PlayerId): Action[] {
  if (gameIsOver(state)) return [];
  if (state.pending.length > 0) return choiceActions(state, viewer);

  if (state.phase === Phase.Setup && state.setup) {
    if (state.activePlayer !== viewer) return [];
    if (state.setup.step === SetupStep.ChooseParty) {
      return state.setup.dealtParties[viewer].map((partyId) => ({ type: "chooseParty" as const, player: viewer, partyId }));
    }
    const offer = state.setup.startingOffers[viewer];
    return offer.map((_, omit) => ({
      type: "chooseStartingHand" as const,
      player: viewer,
      instanceIds: offer.filter((_, index) => index !== omit).map((card) => card.instanceId),
    }));
  }

  if (state.phase === Phase.DecreeChoice) {
    if (state.pendingDecrees?.player !== viewer) return [];
    return inactiveDecrees(state).map((decreeId) => ({ type: "activateDecree" as const, player: viewer, decreeId }));
  }

  if (state.activePlayer !== viewer) return [];

  if (state.phase === Phase.Action) {
    const actions: Action[] = [];
    if (!state.turn.mainActionDone) actions.push(...mainActions(state, viewer));
    actions.push(...freeActions(state, viewer));
    actions.push(...setAsideActions(state, viewer));
    if (state.turn.mainActionDone || mainActions(state, viewer).length === 0) {
      actions.push({ type: "endAction" as const, player: viewer });
    }
    return actions;
  }

  if (state.phase === Phase.Politics) {
    return [...politicsActions(state, viewer), ...setAsideActions(state, viewer)];
  }

  if (state.phase === Phase.Income) {
    return [
      ...state.market
        .filter((card) => !isEventCard(card))
        .map((card) => ({ type: "takeMarket" as const, player: viewer, instanceId: card.instanceId })),
      ...buyEventActions(state, viewer),
      ...setAsideActions(state, viewer),
    ];
  }

  return [];
}

export const isLegalAction = (state: GameState, action: Action, viewer: PlayerId): boolean =>
  legalActions(state, viewer).some((legal) => actionsEqual(legal, action));

export function mainActions(state: GameState, viewer: PlayerId): Action[] {
  const actions: Action[] = [];
  for (const card of handLikeCards(state, viewer, { market: true })) {
    const def = getCard(card.cardId);
    const inHandOnly = !state.market.includes(card);
    if (def.kind === CardKind.Civil && playBlockReason(state, card.cardId) === null) {
      actions.push({ type: "playCivil", player: viewer, instanceId: card.instanceId });
    } else if (inHandOnly && def.kind === CardKind.Alliance && canPlayAlliance(state, viewer, def.district)) {
      actions.push({ type: "playAlliance", player: viewer, instanceId: card.instanceId });
    } else if (inHandOnly && def.kind === CardKind.Conspiracy && playBlockReason(state, card.cardId) === null) {
      actions.push({ type: "playConspiracy", player: viewer, instanceId: card.instanceId });
    }
  }

  for (const district of DISTRICTS) {
    // Martial Law: recruiting and constructing both discard 2+ cards of the district.
    if (martialLawBlocks(state, [district, district])) continue;
    const ids = handCardsInDistrict(state, viewer, district).map((card) => card.instanceId);
    if (canRecruitIn(state, viewer, district)) {
      for (const combo of combinations(ids, RECRUIT_COST)) {
        actions.push({ type: "recruit", player: viewer, instanceIds: combo });
      }
    }
    const monuments = state.availableMonuments.filter((entry) => printedDistrict(entry.cardId) === district);
    if (monuments.length > 0) {
      for (const combo of combinations(ids, CONSTRUCT_COST)) {
        for (const monument of monuments) {
          actions.push({
            type: "construct",
            player: viewer,
            instanceIds: combo,
            monumentInstanceId: monument.instanceId,
          });
        }
      }
    }
  }
  return actions;
}

/**
 * Politics step: exactly one of Influence Senate, Propose Policy, or Declare
 * Victory, or pass. Proposals are listed with every hand card revealed (the
 * engine accepts any passing subset); the UI builds its own reveal set.
 */
function politicsActions(state: GameState, viewer: PlayerId): Action[] {
  const actions: Action[] = [];
  const cards = handLikeCards(state, viewer, { market: false });
  for (const card of cards) {
    actions.push({ type: "influenceSenate", player: viewer, instanceId: card.instanceId });
  }
  const revealIds = cards.map((card) => card.instanceId);
  const revealCardIds = cards.map((card) => card.cardId);
  if (cards.length > 0 && revealPasses(state, revealCardIds)) {
    for (const target of policyTargets(state, revealCardIds)) {
      for (const discardId of revealIds) {
        actions.push({
          type: "proposePolicy",
          player: viewer,
          revealIds,
          discardId,
          district: target.district,
          policyId: target.policyId,
        });
      }
    }
  }
  for (const victory of declarableVictories(state, viewer)) {
    actions.push({ type: "declareVictory", player: viewer, victory });
  }
  actions.push({ type: "endPolitics", player: viewer });
  return actions;
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

  // Parties are chosen in secret; the other seat picks next.
  const other = action.player === 0 ? 1 : 0;
  if (!setup.chosenParty[other]) {
    state.activePlayer = other;
    return events;
  }

  // Both chosen: reveal together. The lower party number is the first player and
  // keeps 3 of their 4 listed cards; the other player takes all 4.
  events.push(...revealParties(state));
  const first = state.firstPlayer!;
  const second = first === 0 ? 1 : 0;
  dealStartingOffer(state, first);
  dealStartingOffer(state, second);
  events.push(takeStartingHand(state, second, setup.startingOffers[second].map((card) => card.instanceId)));
  setup.step = SetupStep.ChooseStartingHand;
  state.activePlayer = first;
  return events;
}

function applyChooseStartingHand(
  state: GameState,
  action: ChooseStartingHandAction,
  rng: Rng,
): GameEvent[] {
  const setup = requireSetup(state, SetupStep.ChooseStartingHand);
  if (action.player !== state.firstPlayer) {
    throw new IllegalActionError(
      "Only the first player (lower party number) picks 3 of 4; the other player takes all 4",
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
    throw new IllegalActionError("The first player keeps 3 of their 4 listed starting cards");
  }

  const events: GameEvent[] = [takeStartingHand(state, action.player, action.instanceIds)];
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

function requirePhase(state: GameState, phase: (typeof Phase)[keyof typeof Phase]) {
  if (state.phase !== phase) {
    throw new IllegalActionError(`Expected ${phase} phase, got ${state.phase}`);
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
  if (a.type === "playAlliance" && b.type === "playAlliance") {
    return a.instanceId === b.instanceId;
  }
  if (a.type === "playConspiracy" && b.type === "playConspiracy") {
    return a.instanceId === b.instanceId;
  }
  if (a.type === "recruit" && b.type === "recruit") {
    return sameIdSet(a.instanceIds, b.instanceIds);
  }
  if (a.type === "construct" && b.type === "construct") {
    return (
      sameIdSet(a.instanceIds, b.instanceIds) &&
      a.monumentInstanceId === b.monumentInstanceId
    );
  }
  if (a.type === "influenceSenate" && b.type === "influenceSenate") {
    return a.instanceId === b.instanceId;
  }
  if (a.type === "proposePolicy" && b.type === "proposePolicy") {
    return (
      sameIdSet(a.revealIds, b.revealIds) &&
      a.discardId === b.discardId &&
      a.district === b.district &&
      a.policyId === b.policyId
    );
  }
  if (a.type === "declareVictory" && b.type === "declareVictory") {
    return sameVictory(a.victory, b.victory);
  }
  if (a.type === "activateDecree" && b.type === "activateDecree") {
    return a.decreeId === b.decreeId;
  }
  if (a.type === "takeMarket" && b.type === "takeMarket") {
    return a.instanceId === b.instanceId;
  }
  if (a.type === "endAction" && b.type === "endAction") return true;
  if (a.type === "endPolitics" && b.type === "endPolitics") return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function chosenPartyId(
  state: GameState,
  player: PlayerId,
): PartyIdValue | null {
  return state.players[player].partyId ?? state.setup?.chosenParty[player] ?? null;
}

export function playTargetDistrict(
  state: GameState,
  player: PlayerId,
  instanceId: string,
): DistrictId | null {
  const card = handLikeCards(state, player, { market: true }).find((entry) => entry.instanceId === instanceId);
  if (!card) return null;
  const def = getCard(card.cardId);
  if (
    def.kind === CardKind.Civil ||
    def.kind === CardKind.Alliance ||
    def.kind === CardKind.Conspiracy
  ) {
    return def.district;
  }
  return null;
}

