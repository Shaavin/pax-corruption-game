import { getCard } from "../cards/catalog.ts";
import { CardKind, DISTRICTS, type DistrictId, type PartyIdValue } from "../cards/schema.ts";
import { martialLawBlocks } from "./abilities.ts";
import { chooseDiscard, choiceActions, chooseIntel, choosePress, chooseSwap, routeDiscards, trimAlliances } from "./choices.ts";
import { inactiveDecrees } from "./decrees.ts";
import { gameIsOver } from "./discard.ts";
import { activateDecree } from "./election.ts";
import { IllegalActionError, asIllegal } from "./errors.ts";
import { applyFreeAction, freeActions, hasFreeAction } from "./free-actions.ts";
import { applyNetworkMove, networkActions, syncNetworks } from "./network.ts";
import { drawToHand } from "./draw.ts";
import { fundMonument, fundOptions, monumentCost } from "./monuments.ts";
import { afterMainAction, completeIncome, proceed, setFreeActionCheck, takeMarketCard, underHandLimit } from "./income.ts";
import { applyBuyEvent, buyEventActions } from "./events.ts";
import { isEventCard } from "./world.ts";
import {
  RECRUIT_COST,
  canPlayAlliance,
  canRecruitIn,
  combinations,
  handCardsInDistrict,
  handLikeCards,
  printedDistrict,
} from "./main.ts";
import { construct, playBlockReason, playConspiracy, playToLane, proposePolicy, recruit, seatSenator } from "./plays.ts";
import { createSeededRng, type Rng } from "./rng.ts";
import { bestReveal, policyTargets, revealPasses } from "./senate.ts";
import { dealStartingOffer, finishSetup, revealParties, takeStartingHand } from "./setup.ts";
import {
  Phase,
  SetupStep,
  type Action,
  type ApplyResult,
  type ChoosePartyAction,
  type ChooseStartingHandAction,
  type FreeActionAction,
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
      construct(next, action.player, action.instanceIds, action.monumentInstanceId, rng, events);
      afterMainAction(next, events);
      break;
    case "endAction":
      requirePhase(next, Phase.Action);
      if (!next.turn.mainActionDone) {
        if (mainActionReachable(next, action.player)) {
          throw new IllegalActionError("A main action is still available");
        }
        // Stuck turn: draw a card (even past the hand limit) instead of the main action.
        drawToHand(next, action.player, events);
        next.turn.mainActionDone = true;
      }
      proceed(next, "politics", events);
      break;
    case "freeAction":
      if (next.phase === Phase.Action && !next.turn.mainActionDone && !freeActionKeepsMain(next, action)) {
        throw new IllegalActionError("That free action would leave you no main action");
      }
      applyFreeAction(next, action, rng, events);
      break;
    case "toNetwork":
    case "fromNetwork":
      applyNetworkMove(next, action, events);
      break;
    case "setAside":
      // Records from before the network (engine < 2026-11-18.1): Planet Next bank,
      // Consultative Office, and East reveals all became the network.
      applyNetworkMove(next, { type: "toNetwork", player: action.player, instanceIds: action.instanceIds }, events);
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
    case "fundMonument":
      requirePhase(next, Phase.Politics);
      fundMonument(next, action.player, action.instanceId, action.monumentInstanceId, events);
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
    case "passIncome":
      requirePhase(next, Phase.Income);
      if (underHandLimit(next, action.player)) {
        throw new IllegalActionError("Take a Market card (or buy an event) at income");
      }
      completeIncome(next, events);
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
    case "trimAlliances":
      trimAlliances(next, action.player, action.instanceIds, events);
      break;
    default: {
      const never: never = action;
      throw new IllegalActionError(`Unknown action ${(never as Action).type}`);
    }
  }
  syncNetworks(next, events);
  return { state: next, events };
}

function isChoiceAction(action: Action): boolean {
  return (
    action.type === "chooseDiscard" ||
    action.type === "chooseSwap" ||
    action.type === "chooseIntel" ||
    action.type === "choosePress" ||
    action.type === "routeDiscards" ||
    action.type === "trimAlliances"
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
    const mainDone = state.turn.mainActionDone;
    const mains = mainDone ? [] : mainActions(state, viewer);
    const frees = playableFreeActions(state, viewer);
    const actions: Action[] = [...mains, ...frees, ...networkActions(state, viewer)];
    // Before the main action, endAction is the stuck-turn draw: no main action reachable at all.
    if (mainDone || (mains.length === 0 && frees.length === 0)) {
      actions.push({ type: "endAction" as const, player: viewer });
    }
    return actions;
  }

  if (state.phase === Phase.Politics) {
    return [...politicsActions(state, viewer), ...networkActions(state, viewer)];
  }

  if (state.phase === Phase.Income) {
    const room = underHandLimit(state, viewer);
    return [
      // Taking a Market card needs room in hand; buying an event (played at once) doesn't.
      ...(room ? state.market.filter((card) => !isEventCard(card)) : []).map((card) => ({
        type: "takeMarket" as const,
        player: viewer,
        instanceId: card.instanceId,
      })),
      ...buyEventActions(state, viewer),
      ...networkActions(state, viewer),
      // At the hand limit buying an event is optional: the player may pass.
      ...(room ? [] : [{ type: "passIncome" as const, player: viewer }]),
    ];
  }

  return [];
}

export const isLegalAction = (state: GameState, action: Action, viewer: PlayerId): boolean =>
  legalActions(state, viewer).some((legal) => actionsEqual(legal, action));

// --- Main-action ruling (Ian, 2026-11-14) ------------------------------------
// A player who can reach a main action this turn, directly or through free actions,
// must take one. Before the main action, a free action is legal only if a main action
// is still reachable afterwards (the "undo it" case never arises). A player who can't
// reach one at all is stuck: they draw a card and move on, with no free actions.

/** Fixed RNG for probes; they run on a copy with every hidden pile emptied. */
const PROBE_RNG = createSeededRng(0);

/** Can `player` still reach a main action this action step (directly or via free actions)? */
export function mainActionReachable(state: GameState, player: PlayerId): boolean {
  if (state.turn.mainActionDone) return true;
  if (mainActions(state, player).length > 0) return true;
  return freeActions(state, player).some((action) => freeActionKeepsMain(state, action));
}

/**
 * Would a main action still be reachable after `action`? The probe hides the deck, monument
 * deck, and event deck: legality never depends on unseen cards.
 */
function freeActionKeepsMain(state: GameState, action: FreeActionAction): boolean {
  const probe = cloneState(state);
  probe.deck = [];
  probe.monumentDeck = [];
  if (probe.expansion) probe.expansion.eventDeck = [];
  try {
    applyFreeAction(probe, action, PROBE_RNG, []);
  } catch (error) {
    if (error instanceof IllegalActionError) return true; // apply reports the real reason
    throw error;
  }
  if (probe.phase !== Phase.Action || probe.turn.mainActionDone) return true;
  probe.pending = [];
  return mainActionReachable(probe, action.player);
}

/** Free actions `player` may take now: after the main action, all; before it, those that keep one reachable. */
export function playableFreeActions(state: GameState, player: PlayerId): FreeActionAction[] {
  const frees = freeActions(state, player);
  if (state.phase !== Phase.Action || state.turn.mainActionDone) return frees;
  return frees.filter((action) => freeActionKeepsMain(state, action));
}

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
    // Each monument costs 5 cards of its district, less 1 per card tucked under it.
    for (const monument of state.availableMonuments) {
      if (printedDistrict(monument.cardId) !== district) continue;
      for (const combo of combinations(ids, monumentCost(state, monument.instanceId))) {
        actions.push({ type: "construct", player: viewer, instanceIds: combo, monumentInstanceId: monument.instanceId });
      }
    }
  }
  return actions;
}

/**
 * Politics step: exactly one of Influence Senate, Propose Policy, Fund a monument, or
 * Declare Victory, or pass. Proposals are listed with every hand card revealed (the
 * engine accepts any passing subset); the UI builds its own reveal set.
 */
function politicsActions(state: GameState, viewer: PlayerId): Action[] {
  const actions: Action[] = [];
  const cards = handLikeCards(state, viewer, { market: false });
  for (const card of cards) {
    actions.push({ type: "influenceSenate", player: viewer, instanceId: card.instanceId });
  }
  // One representative proposal: the strongest allowed reveal (no duds, no double-ups).
  const reveal = bestReveal(state, cards);
  const revealIds = reveal.map((card) => card.instanceId);
  const revealCardIds = reveal.map((card) => card.cardId);
  if (reveal.length > 0 && revealPasses(state, revealCardIds)) {
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
  actions.push(...fundOptions(state, viewer));
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
  if (a.type === "fundMonument" && b.type === "fundMonument") {
    return a.instanceId === b.instanceId && a.monumentInstanceId === b.monumentInstanceId;
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
  if (a.type === "passIncome" && b.type === "passIncome") return true;
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

