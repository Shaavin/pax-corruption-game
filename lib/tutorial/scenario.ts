/**
 * Tutorial positions: a compact description of a table, built into a full `GameState` the
 * engine plays on like any other. Every card is a real catalog card; whatever a scenario
 * doesn't place goes into the draw deck (shuffled with a fixed seed, so lessons always deal
 * the same), and the General Elections sit deep in the deck unless a scenario places them.
 */
import { EVENTS, WORLD_POWERS, type ExpansionVictoryId, type WorldPowerId } from "../cards/expansion.ts";
import { MAIN_DECK, MONUMENTS, PARTIES } from "../cards/catalog.ts";
import {
  CardKind,
  DISTRICTS,
  type DecreeIdValue,
  type DistrictId,
  type MonumentIdValue,
  type PartyIdValue,
  type PolicyIdValue,
} from "../cards/schema.ts";
import { snapshotMarket } from "../game/draw.ts";
import { createEmptyElection } from "../game/election.ts";
import { initialDecrees } from "../game/decrees.ts";
import { createSeededRng } from "../game/rng.ts";
import { TABLE_DISTRICT_ORDER } from "../game/setup.ts";
import { GameMode, Phase, type CardInstance, type GameState, type PlayerId, type PlayerState } from "../game/types.ts";
import { createEmptyPlayer, emptyByDistrict, emptyTurn } from "../game/zones.ts";

/** One seat's cards. Card ids are catalog ids (each physical card exists once). */
export type SeatSpec = {
  party: PartyIdValue;
  hand?: string[];
  tableau?: Partial<Record<DistrictId, string[]>>;
  support?: Partial<Record<DistrictId, string[]>>;
  monuments?: MonumentIdValue[];
  partisans?: number;
  electionWins?: number;
  /** Expansion: relation with each World Power. */
  relations?: Partial<Record<WorldPowerId, number>>;
};

export type ScenarioSpec = {
  /** Seat 0, the learner. */
  you: SeatSpec;
  /** Seat 1, the computer opponent. */
  opponent: SeatSpec;
  /** Exactly 5 Senators, left to right. */
  senate: string[];
  /** Left to right (expansion events by event id). */
  market: string[];
  /** Cards drawn first, top first: the income refill and draws take these in order. */
  deckTop?: string[];
  /** Seed for shuffling the rest of the deck. */
  seed: number;
  policies?: Partial<Record<DistrictId, PolicyIdValue>>;
  activeDecrees?: DecreeIdValue[];
  /** Monuments available to build (the rest form the monument deck). */
  monuments?: MonumentIdValue[];
  /**
   * An election under way: `out` General Elections already revealed (this phase counts
   * `thisPhase` of them for decrees). The others go into the deck at `deckAt` positions.
   */
  election?: { out: number; thisPhase: number };
  /** Deck positions (0 = top) of the General Elections still in the deck. Default: deep. */
  electionsAt?: number[];
  /** Legacy & Diplomacy. */
  expansion?: {
    activeVictories?: ExpansionVictoryId[];
    /** Events in effect, with their buyer. */
    inEffect?: { event: string; owner: PlayerId | null }[];
    /** Top of the event deck (next event revealed), top first. */
    eventDeckTop?: string[];
  };
};

const ELECTION_IDS = MAIN_DECK.filter((card) => card.kind === CardKind.Election).map((card) => card.id);

/** Deck positions that keep the General Elections well out of a short lesson's reach. */
const DEEP = [40, 55, 70, 80];

function card(cardId: string, faceUp: boolean): CardInstance {
  return { instanceId: cardId, cardId, faceUp };
}

/** Build the game state for a scenario. Throws if a card is placed twice or doesn't exist. */
export function buildScenario(spec: ScenarioSpec): GameState {
  const used = new Set<string>();
  const known = new Set([...MAIN_DECK.map((entry) => entry.id), ...EVENTS.map((entry) => entry.id)]);
  const take = (cardId: string, faceUp: boolean): CardInstance => {
    if (!known.has(cardId)) throw new Error(`Unknown card ${cardId}`);
    if (used.has(cardId)) throw new Error(`Card ${cardId} is placed twice`);
    used.add(cardId);
    // Expansion events use the same instance ids as a normal game ("ev-<id>").
    return EVENTS.some((entry) => entry.id === cardId)
      ? { instanceId: `ev-${cardId}`, cardId, faceUp: true }
      : card(cardId, faceUp);
  };

  const seat = (spec: SeatSpec): PlayerState => {
    const player = createEmptyPlayer();
    player.partyId = spec.party;
    player.hand = (spec.hand ?? []).map((id) => take(id, false));
    player.tableau = emptyByDistrict(() => []);
    player.support = emptyByDistrict(() => []);
    for (const district of DISTRICTS) {
      player.tableau[district] = (spec.tableau?.[district] ?? []).map((id) => take(id, true));
      player.support[district] = (spec.support?.[district] ?? []).map((id) => take(id, true));
    }
    player.monuments = (spec.monuments ?? []).map((id) => {
      used.add(id);
      return card(id, true);
    });
    player.partisans = spec.partisans ?? 0;
    player.electionWins = spec.electionWins ?? 0;
    return player;
  };

  const you = seat(spec.you);
  const opponent = seat(spec.opponent);
  if (spec.senate.length !== 5) throw new Error("The Senate needs exactly 5 cards");
  const senate = spec.senate.map((id) => take(id, true));
  const market = spec.market.map((id) => take(id, true));
  const deckTop = (spec.deckTop ?? []).map((id) => take(id, false));

  // Elections: revealed ones are set aside; the rest go into the deck.
  const electionsOut = ELECTION_IDS.slice(0, spec.election?.out ?? 0).map((id) => take(id, true));
  const electionsInDeck = ELECTION_IDS.slice(spec.election?.out ?? 0).map((id) => take(id, false));

  const rng = createSeededRng(spec.seed);
  const rest = rng.shuffle(
    MAIN_DECK.filter((entry) => entry.kind !== CardKind.Election && !used.has(entry.id)).map((entry) => card(entry.id, false)),
  );
  const deck = [...deckTop, ...rest];
  const positions = spec.electionsAt ?? DEEP;
  electionsInDeck.forEach((election, index) => {
    const at = Math.min(positions[index] ?? DEEP[index] ?? deck.length, deck.length);
    deck.splice(at, 0, election);
  });

  const owned = new Set([...you.monuments, ...opponent.monuments].map((entry) => entry.cardId));
  const available = (spec.monuments ?? []).filter((id) => !owned.has(id));
  const monumentDeck = MONUMENTS.map((entry) => entry.id).filter((id) => !owned.has(id) && !available.includes(id));

  const decrees = initialDecrees().map((decree) => ({ ...decree, active: (spec.activeDecrees ?? []).includes(decree.id) }));
  const chosen = new Set([spec.you.party, spec.opponent.party]);
  const policy = emptyByDistrict<PolicyIdValue | null>(() => null);
  for (const district of DISTRICTS) policy[district] = spec.policies?.[district] ?? null;

  const election = createEmptyElection();
  if (spec.election) {
    election.active = true;
    election.generalElections = spec.election.thisPhase;
  }

  const state: GameState = {
    mode: GameMode.Standard,
    seed: spec.seed,
    phase: Phase.Action,
    setup: null,
    activePlayer: 0,
    // The learner is the first player: a first-election tie goes their way.
    firstPlayer: 0,
    election,
    players: [you, opponent],
    districtOrder: [...TABLE_DISTRICT_ORDER],
    policy,
    senate,
    market,
    deck,
    availableMonuments: available.map((id) => card(id, true)),
    monumentDeck: monumentDeck.map((id) => card(id, false)),
    decrees,
    electionsOut,
    unusedParties: PARTIES.map((party) => party.id).filter((id) => !chosen.has(id)),
    turn: emptyTurn(),
    flags: {},
    pendingDecrees: null,
    pending: [],
    resume: null,
    victory: null,
    expansion: null,
  };

  if (spec.expansion) {
    const zeros = () => Object.fromEntries(WORLD_POWERS.map((power) => [power, 0])) as Record<WorldPowerId, number>;
    const relations = { 0: { ...zeros(), ...spec.you.relations }, 1: { ...zeros(), ...spec.opponent.relations } };
    const commonArea = (spec.expansion.inEffect ?? []).map((entry) => ({ card: take(entry.event, true), owner: entry.owner }));
    const eventTop = (spec.expansion.eventDeckTop ?? []).map((id) => take(id, true));
    const eventRest = rng.shuffle(EVENTS.filter((entry) => !used.has(entry.id)).map((entry) => ({
      instanceId: `ev-${entry.id}`,
      cardId: entry.id,
      faceUp: true,
    })));
    state.expansion = {
      foreignInfluence: false,
      eventDeck: [...eventTop, ...eventRest],
      box: [],
      commonArea,
      relations,
      activeVictories: spec.expansion.activeVictories ?? [],
      turnMarket: [],
      eventCosts: {},
      rowBreak: null,
      turnRows: null,
    };
    // Spots and event costs are fixed at the start of a turn.
    snapshotMarket(state);
  }
  return state;
}
