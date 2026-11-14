import {
  findDeckCards,
  getParty,
  MAIN_DECK,
  MONUMENTS,
  PARTIES,
} from "../cards/catalog.ts";
import { CardKind, DISTRICTS, type DistrictId, type PartyIdValue } from "../cards/schema.ts";
import { initialDecrees } from "./decrees.ts";
import { snapshotMarket } from "./draw.ts";
import { setUpExpansion } from "./events.ts";
import { createEmptyElection } from "./election.ts";
import { SENATE_SIZE } from "./senate.ts";
import type { Rng } from "./rng.ts";
import {
  GameMode,
  type GameModeId,
  Phase,
  SetupStep,
  type CardInstance,
  type GameEvent,
  type GameState,
  type PlayerId,
} from "./types.ts";
import {
  createEmptyPlayer,
  emptyByDistrict,
  emptyTurn,
  instantiate,
  otherPlayer,
} from "./zones.ts";

/**
 * One draw pile, top (A) to bottom (E). `cards` is the non-election count.
 * - `shuffled`: `X & Y` — the Y General Elections are shuffled into the X cards
 * - `bottom`: `X + 1` — the General Election goes at the bottom of the pile
 */
export type DrawPilePlan = {
  name: string;
  cards: number;
  elections: number;
  placement: "shuffled" | "bottom";
};

const pile = (name: string, cards: number, elections = 0, placement: DrawPilePlan["placement"] = "shuffled"): DrawPilePlan => ({
  name,
  cards,
  elections,
  placement,
});

/** The rulebook's draw-deck modes. Every mode is 87 cards + 4 General Elections. */
export const DRAW_PLANS: Record<GameModeId, readonly DrawPilePlan[]> = {
  [GameMode.Standard]: [pile("A", 5), pile("B", 9, 1), pile("C", 24, 1), pile("D", 44, 2), pile("E", 5)],
  [GameMode.Tourney]: [
    pile("A", 10, 1, "bottom"),
    pile("B", 22, 1, "bottom"),
    pile("C", 20, 1, "bottom"),
    pile("D", 18, 1, "bottom"),
    pile("E", 17),
  ],
  // C and D are one pile.
  [GameMode.Chaotic]: [pile("A", 8, 1, "bottom"), pile("B", 10), pile("C+D", 64, 3), pile("E", 5)],
  [GameMode.Epic]: [
    pile("A", 4, 1, "bottom"),
    pile("B", 20, 1, "bottom"),
    pile("C", 8),
    pile("D", 35, 1),
    pile("E", 20, 1),
  ],
};

export const GAME_MODES: readonly { id: GameModeId; name: string; term: string; blurb: string }[] = [
  { id: GameMode.Standard, name: "Standard", term: "Random", blurb: "General Elections shuffled into the middle piles." },
  { id: GameMode.Tourney, name: "Tourney", term: "Fixed", blurb: "Elections at fixed depths: a steady, predictable pace." },
  { id: GameMode.Chaotic, name: "Chaotic", term: "Hybrid", blurb: "An early election, then three hidden in one big pile." },
  { id: GameMode.Epic, name: "Epic", term: "Hybrid", blurb: "Two quick elections, then a long game to the end." },
];

export function isGameMode(value: unknown): value is GameModeId {
  return typeof value === "string" && value in DRAW_PLANS;
}


/** 104 non-election − 7 starting − 5 Senate − 5 Market. */
export const PILE_CARD_COUNT = 87;

export type DrawPileSlice = {
  name: string;
  start: number;
  end: number;
  elections: number;
};

export function standardPileSlices(): DrawPileSlice[] {
  return pileSlices(GameMode.Standard);
}

/** Where each pile sits in the built deck (index 0 = top). */
export function pileSlices(mode: GameModeId): DrawPileSlice[] {
  let start = 0;
  return DRAW_PLANS[mode].map((pile) => {
    const length = pile.cards + pile.elections;
    const slice = {
      name: pile.name,
      start,
      end: start + length,
      elections: pile.elections,
    };
    start += length;
    return slice;
  });
}

export type GameOptions = {
  seed: number;
  mode?: GameModeId;
  /** Legacy & Diplomacy expansion. */
  expansion?: boolean;
  /** Expansion variant: 3 random events start in play. */
  foreignInfluence?: boolean;
};

/** Left to right as the overview cards sit in the Tabletop Simulator save, seen from the default seat. */
export const TABLE_DISTRICT_ORDER: readonly DistrictId[] = ["shavvinne", "horsard", "dragonara", "smarbbit"];

export function createGame(rng: Rng, options: GameOptions): GameState {
  // The order used to be shuffled. Still draw the shuffle so every later shuffle (and so
  // every seed's deal) stays the same; the board now always matches the physical table.
  rng.shuffle(DISTRICTS);
  const districtOrder = [...TABLE_DISTRICT_ORDER];
  const parties = rng.shuffle(PARTIES.map((party) => party.id));
  const dealtParties: Record<PlayerId, PartyIdValue[]> = {
    0: parties.slice(0, 2),
    1: parties.slice(2, 4),
  };
  const nonElectionPool = MAIN_DECK.filter(
    (card) => card.kind !== CardKind.Election,
  ).map((card) => instantiate(card.id));
  const electionCards = MAIN_DECK.filter(
    (card) => card.kind === CardKind.Election,
  ).map((card) => instantiate(card.id));

  return {
    mode: options.mode ?? GameMode.Standard,
    seed: options.seed,
    phase: Phase.Setup,
    setup: {
      step: SetupStep.ChooseParty,
      dealtParties,
      chosenParty: { 0: null, 1: null },
      startingOffers: { 0: [], 1: [] },
      nonElectionPool,
      electionCards,
      expansion: options.expansion ? { foreignInfluence: Boolean(options.foreignInfluence) } : null,
    },
    activePlayer: 0,
    firstPlayer: null,
    election: createEmptyElection(),
    players: [createEmptyPlayer(), createEmptyPlayer()],
    districtOrder,
    policy: emptyByDistrict(() => null),
    senate: [],
    market: [],
    deck: [],
    availableMonuments: [],
    monumentDeck: [],
    decrees: initialDecrees(),
    electionsOut: [],
    unusedParties: [],
    turn: emptyTurn(),
    flags: {},
    pendingDecrees: null,
    pending: [],
    resume: null,
    victory: null,
    expansion: null,
  };
}

export function revealParties(state: GameState): GameEvent[] {
  const setup = state.setup;
  if (!setup) throw new Error("revealParties requires setup state");
  const party0 = setup.chosenParty[0];
  const party1 = setup.chosenParty[1];
  if (!party0 || !party1) {
    throw new Error("Both players must choose a party before reveal");
  }

  state.players[0].partyId = party0;
  state.players[1].partyId = party1;
  const chosen = new Set<PartyIdValue>([party0, party1]);
  state.unusedParties = PARTIES.map((party) => party.id).filter(
    (id) => !chosen.has(id),
  );

  const order0 = getParty(party0).order;
  const order1 = getParty(party1).order;
  state.firstPlayer = order0 < order1 ? 0 : 1;

  return [
    {
      type: "partiesRevealed",
      parties: { 0: party0, 1: party1 },
      firstPlayer: state.firstPlayer,
    },
  ];
}

export function dealStartingOffer(state: GameState, player: PlayerId): CardInstance[] {
  const setup = state.setup;
  if (!setup) throw new Error("dealStartingOffer requires setup state");
  const partyId = setup.chosenParty[player];
  if (!partyId) {
    throw new Error("A party must be chosen before starting cards");
  }
  const reserved = new Set<string>();
  for (const seat of state.players) {
    for (const card of seat.hand) reserved.add(card.instanceId);
  }
  for (const offer of Object.values(setup.startingOffers)) {
    for (const card of offer) reserved.add(card.instanceId);
  }
  const offer = resolveStartingOffer(partyId, setup.nonElectionPool, reserved);
  setup.startingOffers[player] = offer;
  return offer;
}

export function resolveStartingOffer(
  partyId: PartyIdValue,
  pool: CardInstance[],
  reserved: Set<string>,
): CardInstance[] {
  const party = getParty(partyId);
  return party.startingCards.map((ref) => {
    const matches = findDeckCards(ref);
    const match = pool.find((card) => {
      if (reserved.has(card.instanceId)) return false;
      return matches.some((entry) => entry.id === card.cardId);
    });
    if (!match) {
      throw new Error(
        `Cannot resolve ${party.name} starting card ${ref.name} (${ref.district})`,
      );
    }
    reserved.add(match.instanceId);
    return { ...match, faceUp: true };
  });
}

export function takeStartingHand(
  state: GameState,
  player: PlayerId,
  instanceIds: string[],
): GameEvent {
  const setup = state.setup;
  if (!setup) throw new Error("takeStartingHand requires setup state");
  const chosen = new Set(instanceIds);
  const hand = setup.startingOffers[player].filter((card) =>
    chosen.has(card.instanceId),
  );
  state.players[player].hand = hand.map((card) => ({ ...card, faceUp: false }));
  setup.nonElectionPool = setup.nonElectionPool.filter(
    (card) => !chosen.has(card.instanceId),
  );
  return {
    type: "startingHandTaken",
    player,
    instanceIds: hand.map((card) => card.instanceId),
  };
}

export function finishSetup(state: GameState, rng: Rng): GameEvent[] {
  const setup = state.setup;
  const firstPlayer = state.firstPlayer;
  if (!setup || firstPlayer === null) {
    throw new Error("finishSetup requires revealed parties");
  }

  const events: GameEvent[] = [];
  events.push(...dealMonuments(state, rng));

  const remaining = rng.shuffle(setup.nonElectionPool);
  if (remaining.length !== 97) {
    throw new Error(`Expected 97 non-election cards after starting hands, got ${remaining.length}`);
  }

  const senate = remaining
    .slice(0, SENATE_SIZE)
    .map((card) => ({ ...card, faceUp: true }));
  const market = remaining
    .slice(SENATE_SIZE, SENATE_SIZE + 5)
    .map((card) => ({ ...card, faceUp: true }));
  const pileCards = remaining.slice(SENATE_SIZE + 5);
  if (pileCards.length !== PILE_CARD_COUNT) {
    throw new Error(`Expected ${PILE_CARD_COUNT} pile cards, got ${pileCards.length}`);
  }

  state.senate = senate;
  state.market = market;
  state.deck = buildDrawDeck(state.mode, pileCards, setup.electionCards, rng);
  events.push({ type: "senateDealt", cardIds: senate.map((card) => card.cardId) });
  events.push({
    type: "marketDealt",
    cardIds: market.map((card) => card.cardId),
  });
  events.push({ type: "deckBuilt", size: state.deck.length });

  // Legacy & Diplomacy: after the base setup has used the RNG, so base games are unchanged.
  if (setup.expansion) events.push(...setUpExpansion(state, rng, setup.expansion.foreignInfluence));

  state.phase = Phase.Action;
  state.activePlayer = firstPlayer;
  state.setup = null;
  snapshotMarket(state);
  events.push({ type: "setupComplete", firstPlayer });
  return events;
}

function dealMonuments(state: GameState, rng: Rng): GameEvent[] {
  const firstPlayer = state.firstPlayer;
  if (firstPlayer === null) throw new Error("Monuments need a first player");
  const firstParty = state.players[firstPlayer].partyId;
  const secondParty = state.players[otherPlayer(firstPlayer)].partyId;
  if (!firstParty || !secondParty) {
    throw new Error("Monuments need both parties");
  }

  const guaranteed = [
    getParty(firstParty).guaranteedMonumentId,
    getParty(secondParty).guaranteedMonumentId,
  ];
  const rest = rng.shuffle(
    MONUMENTS.map((monument) => monument.id).filter(
      (id) => !guaranteed.includes(id),
    ),
  );
  const extra = rest.slice(0, 2);
  const deck = rest.slice(2);
  state.availableMonuments = [...guaranteed, ...extra].map((id) =>
    instantiate(id, true),
  );
  state.monumentDeck = deck.map((id) => instantiate(id, false));
  return [
    {
      type: "monumentsSet",
      available: state.availableMonuments.map((card) => card.cardId),
      deck: state.monumentDeck.map((card) => card.cardId),
    },
  ];
}

export function buildStandardDrawDeck(
  pileCards: CardInstance[],
  elections: CardInstance[],
  rng: Rng,
): CardInstance[] {
  return buildDrawDeck(GameMode.Standard, pileCards, elections, rng);
}

/**
 * Stack piles A–E from the (already shuffled) pile cards. Piles without an
 * election are not reshuffled, so Standard consumes the RNG exactly as before
 * and old Standard records still replay.
 */
export function buildDrawDeck(
  mode: GameModeId,
  pileCards: CardInstance[],
  elections: CardInstance[],
  rng: Rng,
): CardInstance[] {
  const plan = DRAW_PLANS[mode];
  if (pileCards.length !== PILE_CARD_COUNT) {
    throw new Error(`Draw piles need ${PILE_CARD_COUNT} cards, got ${pileCards.length}`);
  }
  if (elections.length !== 4) {
    throw new Error(`Draw piles need 4 general elections, got ${elections.length}`);
  }

  let cards = [...pileCards];
  let ges = rng.shuffle(elections);
  const take = (n: number) => {
    const chunk = cards.slice(0, n);
    cards = cards.slice(n);
    return chunk;
  };
  const takeGE = (n: number) => {
    const chunk = ges.slice(0, n);
    ges = ges.slice(n);
    return chunk;
  };

  const deck: CardInstance[] = [];
  for (const pile of plan) {
    const body = take(pile.cards);
    const piles = takeGE(pile.elections);
    if (pile.elections === 0) deck.push(...body);
    else if (pile.placement === "bottom") deck.push(...body, ...piles);
    else deck.push(...rng.shuffle([...body, ...piles]));
  }

  if (cards.length !== 0 || ges.length !== 0) {
    throw new Error(`${mode} pile construction left cards over`);
  }
  return deck;
}
