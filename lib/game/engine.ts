import { getCard } from "../cards/catalog.ts";
import {
  CardKind,
  DISTRICTS,
  type DistrictId,
  type PartyIdValue,
} from "../cards/schema.ts";
import { inactiveDecrees } from "./decrees.ts";
import { discardCards, discardOwn, gameIsOver } from "./discard.ts";
import { activateDecree } from "./election.ts";
import {
  afterMainAction,
  beginIncome,
  takeMarketCard,
  underHandLimit,
} from "./income.ts";
import {
  RECRUIT_COST,
  CONSTRUCT_COST,
  canPlayAlliance,
  canRecruitIn,
  combinations,
  handCardsInDistrict,
  printedDistrict,
  takeSpend,
} from "./main.ts";
import type { Rng } from "./rng.ts";
import {
  convincedVotes,
  influenceSenate,
  policyOptions,
  policyTargets,
  revealPasses,
  senateTotalVotes,
} from "./senate.ts";
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
  type ActivateDecreeAction,
  type ApplyResult,
  type ChoosePartyAction,
  type ChooseStartingHandAction,
  type ConstructAction,
  type DeclareVictoryAction,
  type EndActionAction,
  type EndPoliticsAction,
  type GameEvent,
  type GameState,
  type InfluenceSenateAction,
  type PlayAllianceAction,
  type PlayCivilAction,
  type PlayConspiracyAction,
  type PlayerId,
  type ProposePolicyAction,
  type RecruitAction,
  type TakeMarketAction,
} from "./types.ts";
import { declarableVictories, endGame, sameVictory } from "./victory.ts";
import { cloneState, sameIdSet, takeInstance } from "./zones.ts";

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalActionError";
  }
}

export function currentActor(state: GameState): PlayerId {
  return state.activePlayer;
}

export function apply(state: GameState, action: Action, rng: Rng): ApplyResult {
  if (gameIsOver(state)) {
    throw new IllegalActionError("The game is over");
  }
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
    case "playAlliance":
      return { state: next, events: applyPlayAlliance(next, action) };
    case "playConspiracy":
      return { state: next, events: applyPlayConspiracy(next, action) };
    case "recruit":
      return { state: next, events: applyRecruit(next, action) };
    case "construct":
      return { state: next, events: applyConstruct(next, action, rng) };
    case "influenceSenate":
      return { state: next, events: applyInfluenceSenate(next, action) };
    case "proposePolicy":
      return { state: next, events: applyProposePolicy(next, action) };
    case "declareVictory":
      return { state: next, events: applyDeclareVictory(next, action) };
    case "endPolitics":
      return { state: next, events: applyEndPolitics(next, action) };
    case "activateDecree":
      return { state: next, events: applyActivateDecree(next, action) };
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
  if (gameIsOver(state)) return [];
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
    const actions = mainActions(state, viewer);
    if (actions.length > 0) return actions;
    return [{ type: "endAction" as const, player: viewer }];
  }

  if (state.phase === Phase.Politics) {
    return politicsActions(state, viewer);
  }

  if (state.phase === Phase.DecreeChoice && state.pendingDecrees?.player === viewer) {
    return inactiveDecrees(state).map((decreeId) => ({
      type: "activateDecree" as const,
      player: viewer,
      decreeId,
    }));
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

export const isLegalAction = (
  state: GameState,
  action: Action,
  viewer: PlayerId,
): boolean => {
  return legalActions(state, viewer).some((legal) => actionsEqual(legal, action));
};

function mainActions(state: GameState, viewer: PlayerId): Action[] {
  const actions: Action[] = [];
  const seat = state.players[viewer];

  for (const card of seat.hand) {
    const def = getCard(card.cardId);
    if (def.kind === CardKind.Civil) {
      actions.push({
        type: "playCivil",
        player: viewer,
        instanceId: card.instanceId,
      });
    } else if (def.kind === CardKind.Alliance && canPlayAlliance(state, viewer, def.district)) {
      actions.push({
        type: "playAlliance",
        player: viewer,
        instanceId: card.instanceId,
      });
    } else if (def.kind === CardKind.Conspiracy) {
      actions.push({
        type: "playConspiracy",
        player: viewer,
        instanceId: card.instanceId,
      });
    }
  }

  for (const district of DISTRICTS) {
    const cards = handCardsInDistrict(state, viewer, district);
    const ids = cards.map((card) => card.instanceId);
    if (canRecruitIn(state, viewer, district)) {
      for (const combo of combinations(ids, RECRUIT_COST)) {
        actions.push({ type: "recruit", player: viewer, instanceIds: combo });
      }
    }
    const monuments = state.availableMonuments.filter(
      (entry) => printedDistrict(entry.cardId) === district,
    );
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
 * Victory, or pass. Proposals are listed with the whole hand revealed (the
 * engine accepts any passing subset); the UI builds its own reveal set.
 */
function politicsActions(state: GameState, viewer: PlayerId): Action[] {
  const actions: Action[] = [];
  const hand = state.players[viewer].hand;

  for (const card of hand) {
    actions.push({ type: "influenceSenate", player: viewer, instanceId: card.instanceId });
  }

  const revealIds = hand.map((card) => card.instanceId);
  if (revealPasses(state, hand.map((card) => card.cardId))) {
    for (const target of policyTargets(state)) {
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

function applyPlayCivil(state: GameState, action: PlayCivilAction): GameEvent[] {
  requirePhase(state, Phase.Action);
  requireActor(state, action.player);
  const seat = state.players[action.player];
  if (!seat.hand.some((card) => card.instanceId === action.instanceId)) {
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

function applyPlayAlliance(state: GameState, action: PlayAllianceAction): GameEvent[] {
  requirePhase(state, Phase.Action);
  requireActor(state, action.player);
  const seat = state.players[action.player];
  if (!seat.hand.some((card) => card.instanceId === action.instanceId)) {
    throw new IllegalActionError("That card is not in your hand");
  }
  const card = takeInstance(seat.hand, action.instanceId);
  const def = getCard(card.cardId);
  if (def.kind !== CardKind.Alliance) {
    seat.hand.push(card);
    throw new IllegalActionError("Only alliance cards can be played this way");
  }
  if (!canPlayAlliance(state, action.player, def.district)) {
    seat.hand.push(card);
    throw new IllegalActionError("Alliance slot in that district is full");
  }

  const played = {
    ...card,
    faceUp: true,
    occupiedDistrict: def.district,
  };
  seat.tableau[def.district].push(played);
  const events: GameEvent[] = [
    {
      type: "alliancePlayed",
      player: action.player,
      instanceId: played.instanceId,
      cardId: played.cardId,
      district: def.district,
    },
  ];
  afterMainAction(state, events);
  return events;
}

function applyPlayConspiracy(
  state: GameState,
  action: PlayConspiracyAction,
): GameEvent[] {
  requirePhase(state, Phase.Action);
  requireActor(state, action.player);
  const seat = state.players[action.player];
  if (!seat.hand.some((card) => card.instanceId === action.instanceId)) {
    throw new IllegalActionError("That card is not in your hand");
  }
  const card = takeInstance(seat.hand, action.instanceId);
  const def = getCard(card.cardId);
  if (def.kind !== CardKind.Conspiracy) {
    seat.hand.push(card);
    throw new IllegalActionError("Only conspiracy cards can be played this way");
  }

  const district = def.district;
  const wiped: { card: typeof card; owner: PlayerId }[] = [];
  for (const owner of [0, 1] as const) {
    const pile = state.players[owner].tableau[district];
    while (pile.length > 0) {
      wiped.push({ card: pile.shift()!, owner });
    }
  }

  const events: GameEvent[] = [
    {
      type: "conspiracyPlayed",
      player: action.player,
      instanceId: card.instanceId,
      cardId: card.cardId,
      district,
    },
  ];
  discardCards(state, action.player, wiped, events);
  discardOwn(state, action.player, [card], events);
  afterMainAction(state, events);
  return events;
}

function applyRecruit(state: GameState, action: RecruitAction): GameEvent[] {
  requirePhase(state, Phase.Action);
  requireActor(state, action.player);
  const seat = state.players[action.player];
  const spent = requireSpend(seat.hand, action.instanceIds, RECRUIT_COST);
  if (!canRecruitIn(state, action.player, spent.district)) {
    for (const card of spent.cards) seat.hand.push(card);
    throw new IllegalActionError(
      "Recruiting needs a card already in your support pile for that district",
    );
  }
  const events: GameEvent[] = [];
  discardOwn(state, action.player, spent.cards, events);
  seat.partisans += 1;
  events.push({
    type: "partisansRecruited",
    player: action.player,
    count: seat.partisans,
  });
  afterMainAction(state, events);
  return events;
}

function applyConstruct(
  state: GameState,
  action: ConstructAction,
  rng: Rng,
): GameEvent[] {
  requirePhase(state, Phase.Action);
  requireActor(state, action.player);
  const seat = state.players[action.player];
  const spent = requireSpend(seat.hand, action.instanceIds, CONSTRUCT_COST);
  const monumentIndex = state.availableMonuments.findIndex(
    (entry) => entry.instanceId === action.monumentInstanceId,
  );
  if (monumentIndex < 0) {
    for (const card of spent.cards) seat.hand.push(card);
    throw new IllegalActionError("That monument is not available");
  }
  const monument = state.availableMonuments[monumentIndex]!;
  if (printedDistrict(monument.cardId) !== spent.district) {
    for (const card of spent.cards) seat.hand.push(card);
    throw new IllegalActionError("Monument district must match the cards spent");
  }

  state.availableMonuments.splice(monumentIndex, 1);
  const placed = { ...monument, faceUp: true };
  seat.monuments.push(placed);
  const events: GameEvent[] = [
    {
      type: "monumentConstructed",
      player: action.player,
      instanceId: placed.instanceId,
      cardId: placed.cardId,
    },
  ];
  replenishMonuments(state, rng, events);
  discardOwn(state, action.player, spent.cards, events);
  state.turn.constructedMonument = true;
  afterMainAction(state, events);
  return events;
}

function replenishMonuments(state: GameState, rng: Rng, events: GameEvent[]): void {
  if (state.monumentDeck.length === 0) return;
  const index = rng.nextInt(state.monumentDeck.length);
  const next = state.monumentDeck.splice(index, 1)[0]!;
  state.availableMonuments.push({ ...next, faceUp: true });
  events.push({ type: "monumentReplenished", cardId: next.cardId });
}

function applyInfluenceSenate(state: GameState, action: InfluenceSenateAction): GameEvent[] {
  requirePhase(state, Phase.Politics);
  requireActor(state, action.player);
  const seat = state.players[action.player];
  if (!seat.hand.some((card) => card.instanceId === action.instanceId)) {
    throw new IllegalActionError("That card is not in your hand");
  }
  const card = takeInstance(seat.hand, action.instanceId);
  const events: GameEvent[] = [];
  influenceSenate(state, action.player, card, events);
  beginIncome(state, events);
  return events;
}

function applyProposePolicy(state: GameState, action: ProposePolicyAction): GameEvent[] {
  requirePhase(state, Phase.Politics);
  requireActor(state, action.player);
  const seat = state.players[action.player];
  const revealIds = action.revealIds;
  if (revealIds.length === 0 || new Set(revealIds).size !== revealIds.length) {
    throw new IllegalActionError("Reveal one or more distinct cards");
  }
  const revealed = revealIds.map((id) => {
    const card = seat.hand.find((entry) => entry.instanceId === id);
    if (!card) throw new IllegalActionError("Revealed cards must come from your hand");
    return card;
  });
  if (!revealIds.includes(action.discardId)) {
    throw new IllegalActionError("The discarded card must be one of the revealed cards");
  }
  const revealedCardIds = revealed.map((card) => card.cardId);
  if (!revealPasses(state, revealedCardIds)) {
    throw new IllegalActionError("Those cards do not convince more than half of the Senate");
  }
  if (!state.districtOrder.includes(action.district)) {
    throw new IllegalActionError("Unknown district");
  }
  if (!policyOptions(state, action.district).includes(action.policyId)) {
    throw new IllegalActionError(
      "Policies move from neutral to a side, or from a side back to neutral",
    );
  }

  const events: GameEvent[] = [
    {
      type: "policyProposed",
      player: action.player,
      revealedCardIds,
      votes: convincedVotes(state, revealedCardIds),
      totalVotes: senateTotalVotes(state),
    },
  ];
  const discarded = takeInstance(seat.hand, action.discardId);
  discardOwn(state, action.player, [discarded], events);
  state.policy[action.district] = action.policyId;
  events.push({
    type: "policyChanged",
    district: action.district,
    policyId: action.policyId,
    player: action.player,
  });
  beginIncome(state, events);
  return events;
}

function applyDeclareVictory(state: GameState, action: DeclareVictoryAction): GameEvent[] {
  requirePhase(state, Phase.Politics);
  requireActor(state, action.player);
  const legal = declarableVictories(state, action.player).find((victory) =>
    sameVictory(victory, action.victory),
  );
  if (!legal) {
    throw new IllegalActionError("That victory cannot be declared now");
  }
  const events: GameEvent[] = [];
  endGame(state, legal, events);
  return events;
}

function applyEndPolitics(state: GameState, action: EndPoliticsAction): GameEvent[] {
  requirePhase(state, Phase.Politics);
  requireActor(state, action.player);
  const events: GameEvent[] = [];
  beginIncome(state, events);
  return events;
}

function applyActivateDecree(state: GameState, action: ActivateDecreeAction): GameEvent[] {
  requirePhase(state, Phase.DecreeChoice);
  requireActor(state, action.player);
  const events: GameEvent[] = [];
  try {
    activateDecree(state, action.player, action.decreeId, events);
  } catch (error) {
    throw new IllegalActionError(
      error instanceof Error ? error.message : "Illegal decree activation",
    );
  }
  return events;
}

function applyEndAction(state: GameState, action: EndActionAction): GameEvent[] {
  requirePhase(state, Phase.Action);
  requireActor(state, action.player);
  if (mainActions(state, action.player).length > 0) {
    throw new IllegalActionError("A main action is still available");
  }
  const events: GameEvent[] = [];
  afterMainAction(state, events);
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

function requireSpend(
  hand: GameState["players"][0]["hand"],
  instanceIds: readonly string[],
  count: number,
) {
  try {
    return takeSpend(hand, instanceIds, count);
  } catch (error) {
    throw new IllegalActionError(
      error instanceof Error ? error.message : "Illegal cards spent",
    );
  }
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
  return false;
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
  const card = state.players[player].hand.find((entry) => entry.instanceId === instanceId);
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
