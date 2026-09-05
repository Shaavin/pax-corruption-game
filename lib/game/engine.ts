import { getCard } from "../cards/catalog.ts";
import {
  CardKind,
  DISTRICTS,
  ExecutiveSide,
  type DistrictId,
  type PartyIdValue,
} from "../cards/schema.ts";
import { discardCards, discardOwn, gameIsOver } from "./discard.ts";
import {
  applyChooseElectionFirst,
  applyChooseExecutiveSide,
  applyEmergencyState,
  applyLegalReview,
  canUseEmergencyState,
  canUseLegalReview,
  legalReviewTargets,
} from "./election.ts";
import {
  afterMainAction,
  beginIncome,
  takeMarketCard,
  underHandLimit,
} from "./income.ts";
import {
  FLAG_CAMPAIGNED,
  RECRUIT_COST,
  CONSTRUCT_COST,
  REFERENDUM_COST,
  REFERENDUM_SUPPORTER_MIN,
  canPlayAlliance,
  combinations,
  handCardsInDistrict,
  printedDistrict,
  takeSpend,
} from "./main.ts";
import { applyPolicyChoice, startReferendum } from "./referendum.ts";
import type { Rng } from "./rng.ts";
import {
  dealStartingOffer,
  finishSetup,
  revealParties,
  takeStartingHand,
} from "./setup.ts";
import {
  Phase,
  ReferendumSource,
  SetupStep,
  type Action,
  type ApplyResult,
  type CallReferendumAction,
  type CampaignAction,
  type ChooseElectionFirstAction,
  type ChooseExecutiveSideAction,
  type ChoosePartyAction,
  type ChoosePolicyAction,
  type ChooseStartingHandAction,
  type ConstructAction,
  type EndActionAction,
  type EndPoliticsAction,
  type GameEvent,
  type GameState,
  type PlayAllianceAction,
  type PlayCivilAction,
  type PlayConspiracyAction,
  type PlayerId,
  type RecruitAction,
  type TakeMarketAction,
  type UseEmergencyStateAction,
  type UseLegalReviewAction,
} from "./types.ts";
import { resolveVictory } from "./victory.ts";
import { cloneState, sameIdSet, takeInstance } from "./zones.ts";

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalActionError";
  }
}

export function currentActor(state: GameState): PlayerId {
  if (state.referendum?.awaitingChoice) return state.referendum.chooser;
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
    case "callReferendum":
      return { state: next, events: applyCallReferendum(next, action) };
    case "choosePolicy":
      return { state: next, events: applyChoosePolicyAction(next, action) };
    case "campaign":
      return { state: next, events: applyCampaign(next, action) };
    case "endPolitics":
      return { state: next, events: applyEndPolitics(next, action) };
    case "useEmergencyState":
      return { state: next, events: applyUseEmergencyState(next, action) };
    case "useLegalReview":
      return { state: next, events: applyUseLegalReview(next, action) };
    case "chooseElectionFirst":
      return { state: next, events: applyChooseElectionFirstAction(next, action) };
    case "chooseExecutiveSide":
      return { state: next, events: applyChooseExecutiveSideAction(next, action) };
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

  if (state.referendum?.awaitingChoice) {
    if (viewer !== state.referendum.chooser) return [];
    const district = state.districtOrder[state.referendum.districtIndex];
    if (!district) return [];
    return state.referendum.options.map((policyId) => ({
      type: "choosePolicy" as const,
      player: viewer,
      district,
      policyId,
    }));
  }

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
    const actions: Action[] = [];
    if (!state.flags[FLAG_CAMPAIGNED]) {
      for (const card of state.players[viewer].hand) {
        actions.push({
          type: "campaign",
          player: viewer,
          instanceId: card.instanceId,
        });
      }
    }
    if (canUseEmergencyState(state, viewer)) {
      actions.push({ type: "useEmergencyState", player: viewer });
    }
    if (canUseLegalReview(state, viewer)) {
      for (const district of legalReviewTargets(state)) {
        actions.push({ type: "useLegalReview", player: viewer, district });
      }
    }
    actions.push({ type: "endPolitics", player: viewer });
    return actions;
  }

  if (state.phase === Phase.ElectionStart) {
    return ( [0, 1] as const ).map((firstPlayer) => ({
      type: "chooseElectionFirst" as const,
      player: viewer,
      firstPlayer,
    }));
  }

  if (state.phase === Phase.ElectionEnd && !state.executive && !state.referendum) {
    return [
      {
        type: "chooseExecutiveSide" as const,
        player: viewer,
        side: ExecutiveSide.EmergencyState,
      },
      {
        type: "chooseExecutiveSide" as const,
        player: viewer,
        side: ExecutiveSide.LegalReview,
      },
    ];
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
    for (const combo of combinations(ids, RECRUIT_COST)) {
      actions.push({ type: "recruit", player: viewer, instanceIds: combo });
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
    if (seat.policySupporters.length >= REFERENDUM_SUPPORTER_MIN) {
      for (const combo of combinations(ids, REFERENDUM_COST)) {
        actions.push({
          type: "callReferendum",
          player: viewer,
          instanceIds: combo,
        });
      }
    }
  }

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
  if (!gameIsOver(state)) afterMainAction(state, events);
  return events;
}

function applyRecruit(state: GameState, action: RecruitAction): GameEvent[] {
  requirePhase(state, Phase.Action);
  requireActor(state, action.player);
  const seat = state.players[action.player];
  const spent = requireSpend(seat.hand, action.instanceIds, RECRUIT_COST);
  const events: GameEvent[] = [];
  discardOwn(state, action.player, spent.cards, events);
  if (gameIsOver(state)) return events;
  seat.partisans += 1;
  events.push({
    type: "partisansRecruited",
    player: action.player,
    count: seat.partisans,
  });
  resolveVictory(state, events);
  if (!gameIsOver(state)) afterMainAction(state, events);
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
  if (!gameIsOver(state)) afterMainAction(state, events);
  return events;
}

function replenishMonuments(state: GameState, rng: Rng, events: GameEvent[]): void {
  if (state.monumentDeck.length === 0) return;
  const index = rng.nextInt(state.monumentDeck.length);
  const next = state.monumentDeck.splice(index, 1)[0]!;
  state.availableMonuments.push({ ...next, faceUp: true });
  events.push({ type: "monumentReplenished", cardId: next.cardId });
}

function applyCallReferendum(
  state: GameState,
  action: CallReferendumAction,
): GameEvent[] {
  requirePhase(state, Phase.Action);
  requireActor(state, action.player);
  const seat = state.players[action.player];
  if (seat.policySupporters.length < REFERENDUM_SUPPORTER_MIN) {
    throw new IllegalActionError("Need at least 3 policy supporters to call a referendum");
  }
  const spent = requireSpend(seat.hand, action.instanceIds, REFERENDUM_COST);
  const events: GameEvent[] = [];
  discardOwn(state, action.player, spent.cards, events);
  if (gameIsOver(state)) return events;
  startReferendum(state, events);
  return events;
}

function applyChoosePolicyAction(
  state: GameState,
  action: ChoosePolicyAction,
): GameEvent[] {
  const events: GameEvent[] = [];
  try {
    applyPolicyChoice(state, action.player, action.district, action.policyId, events);
  } catch (error) {
    throw new IllegalActionError(
      error instanceof Error ? error.message : "Illegal policy choice",
    );
  }
  return events;
}

function applyCampaign(state: GameState, action: CampaignAction): GameEvent[] {
  requirePhase(state, Phase.Politics);
  requireActor(state, action.player);
  if (state.flags[FLAG_CAMPAIGNED]) {
    throw new IllegalActionError("You already campaigned this turn");
  }
  const seat = state.players[action.player];
  if (!seat.hand.some((card) => card.instanceId === action.instanceId)) {
    throw new IllegalActionError("That card is not in your hand");
  }
  const card = takeInstance(seat.hand, action.instanceId);
  seat.policySupporters.push({ ...card, faceUp: false });
  state.flags[FLAG_CAMPAIGNED] = true;
  state.currentTurn.discarded = true;
  const events: GameEvent[] = [
    {
      type: "campaignTucked",
      player: action.player,
      instanceId: card.instanceId,
      cardId: card.cardId,
    },
  ];
  // Campaign is once per turn. Emergency State can still share this step.
  if (!furtherPoliticsAvailable(state, action.player)) {
    beginIncome(state, events);
  }
  return events;
}

function furtherPoliticsAvailable(state: GameState, player: PlayerId): boolean {
  if (!state.flags[FLAG_CAMPAIGNED] && state.players[player].hand.length > 0) {
    return true;
  }
  return canUseEmergencyState(state, player) || canUseLegalReview(state, player);
}

function applyEndPolitics(state: GameState, action: EndPoliticsAction): GameEvent[] {
  requirePhase(state, Phase.Politics);
  requireActor(state, action.player);
  const events: GameEvent[] = [];
  beginIncome(state, events);
  return events;
}

function applyUseEmergencyState(
  state: GameState,
  action: UseEmergencyStateAction,
): GameEvent[] {
  requirePhase(state, Phase.Politics);
  requireActor(state, action.player);
  const events: GameEvent[] = [];
  try {
    applyEmergencyState(state, action.player, events);
  } catch (error) {
    throw new IllegalActionError(
      error instanceof Error ? error.message : "Emergency State is not legal",
    );
  }
  if (!furtherPoliticsAvailable(state, action.player)) {
    beginIncome(state, events);
  }
  return events;
}

function applyUseLegalReview(
  state: GameState,
  action: UseLegalReviewAction,
): GameEvent[] {
  requirePhase(state, Phase.Politics);
  requireActor(state, action.player);
  const events: GameEvent[] = [];
  try {
    applyLegalReview(state, action.player, action.district, events);
  } catch (error) {
    throw new IllegalActionError(
      error instanceof Error ? error.message : "Legal Review is not legal",
    );
  }
  if (!gameIsOver(state) && !furtherPoliticsAvailable(state, action.player)) {
    beginIncome(state, events);
  }
  return events;
}

function applyChooseElectionFirstAction(
  state: GameState,
  action: ChooseElectionFirstAction,
): GameEvent[] {
  requirePhase(state, Phase.ElectionStart);
  requireActor(state, action.player);
  const events: GameEvent[] = [];
  try {
    applyChooseElectionFirst(state, action.player, action.firstPlayer, events);
  } catch (error) {
    throw new IllegalActionError(
      error instanceof Error ? error.message : "Illegal election first-player choice",
    );
  }
  return events;
}

function applyChooseExecutiveSideAction(
  state: GameState,
  action: ChooseExecutiveSideAction,
): GameEvent[] {
  requirePhase(state, Phase.ElectionEnd);
  requireActor(state, action.player);
  const events: GameEvent[] = [];
  try {
    applyChooseExecutiveSide(state, action.player, action.side, events);
  } catch (error) {
    throw new IllegalActionError(
      error instanceof Error ? error.message : "Illegal executive-side choice",
    );
  }
  if (!gameIsOver(state)) {
    startReferendum(state, events, ReferendumSource.Election);
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
  if (a.type === "callReferendum" && b.type === "callReferendum") {
    return sameIdSet(a.instanceIds, b.instanceIds);
  }
  if (a.type === "choosePolicy" && b.type === "choosePolicy") {
    return a.district === b.district && a.policyId === b.policyId;
  }
  if (a.type === "campaign" && b.type === "campaign") {
    return a.instanceId === b.instanceId;
  }
  if (a.type === "takeMarket" && b.type === "takeMarket") {
    return a.instanceId === b.instanceId;
  }
  if (a.type === "endAction" && b.type === "endAction") return true;
  if (a.type === "endPolitics" && b.type === "endPolitics") return true;
  if (a.type === "useEmergencyState" && b.type === "useEmergencyState") return true;
  if (a.type === "useLegalReview" && b.type === "useLegalReview") {
    return a.district === b.district;
  }
  if (a.type === "chooseElectionFirst" && b.type === "chooseElectionFirst") {
    return a.firstPlayer === b.firstPlayer;
  }
  if (a.type === "chooseExecutiveSide" && b.type === "chooseExecutiveSide") {
    return a.side === b.side;
  }
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
