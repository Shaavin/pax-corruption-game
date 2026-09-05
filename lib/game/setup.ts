import {
  findDeckCards,
  getParty,
  MAIN_DECK,
  MONUMENTS,
  PARTIES,
} from "../cards/catalog.ts";
import { CardKind, DISTRICTS, type PartyIdValue } from "../cards/schema.ts";
import { createEmptyElection } from "./election.ts";
import type { Rng } from "./rng.ts";
import {
  GameMode,
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

/** Printed Standard A–E. `cards` is non-GE count; elections are inserted as the mode table says. */
export const STANDARD_DRAW_PLAN = [
  { name: "A", cards: 5, elections: 0 },
  { name: "B", cards: 9, elections: 1 },
  { name: "C", cards: 24, elections: 1 },
  { name: "D", cards: 44, elections: 2 },
  { name: "E", cards: 10, elections: 0 },
] as const;

export type DrawPileSlice = {
  name: string;
  start: number;
  end: number;
  elections: number;
};

export function standardPileSlices(): DrawPileSlice[] {
  let start = 0;
  return STANDARD_DRAW_PLAN.map((pile) => {
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

export function createGame(rng: Rng, options: { seed: number }): GameState {
  const districtOrder = rng.shuffle(DISTRICTS);
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
    mode: GameMode.Standard,
    seed: options.seed,
    phase: Phase.Setup,
    setup: {
      step: SetupStep.ChooseParty,
      dealtParties,
      chosenParty: { 0: null, 1: null },
      startingOffers: { 0: [], 1: [] },
      nonElectionPool,
      electionCards,
    },
    activePlayer: 0,
    firstPlayer: null,
    electionTriggerer: null,
    election: createEmptyElection(),
    players: [createEmptyPlayer(), createEmptyPlayer()],
    districtOrder,
    policy: emptyByDistrict(() => null),
    market: [],
    deck: [],
    availableMonuments: [],
    monumentDeck: [],
    electionsOut: [],
    unusedParties: [],
    executive: null,
    lastTurn: emptyTurn(),
    currentTurn: emptyTurn(),
    flags: {},
    referendum: null,
    victory: null,
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

  const market = remaining.slice(0, 5).map((card) => ({ ...card, faceUp: true }));
  const pileCards = remaining.slice(5);
  if (pileCards.length !== 92) {
    throw new Error(`Expected 92 pile cards, got ${pileCards.length}`);
  }

  state.market = market;
  state.deck = buildStandardDrawDeck(pileCards, setup.electionCards, rng);
  events.push({
    type: "marketDealt",
    cardIds: market.map((card) => card.cardId),
  });
  events.push({ type: "deckBuilt", size: state.deck.length });

  state.phase = Phase.Action;
  state.activePlayer = firstPlayer;
  state.setup = null;
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
  if (pileCards.length !== 92) {
    throw new Error(`Standard piles need 92 cards, got ${pileCards.length}`);
  }
  if (elections.length !== 4) {
    throw new Error(`Standard piles need 4 general elections, got ${elections.length}`);
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

  const A = take(5);
  const B = rng.shuffle([...take(9), ...takeGE(1)]);
  const C = rng.shuffle([...take(24), ...takeGE(1)]);
  const D = rng.shuffle([...take(44), ...takeGE(2)]);
  const E = take(10);

  if (cards.length !== 0 || ges.length !== 0) {
    throw new Error("Standard pile construction leftover cards");
  }

  return [...A, ...B, ...C, ...D, ...E];
}
