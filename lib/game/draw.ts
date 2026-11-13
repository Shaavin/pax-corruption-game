import { getCard } from "../cards/catalog.ts";
import { CardKind } from "../cards/schema.ts";
import type { CardInstance, GameEvent, GameState, PlayerId } from "./types.ts";
import { isEventCard } from "./world.ts";

export const MARKET_SIZE = 5;
export const ELECTION_MARKET_SIZE = 8;

/**
 * A General Election was revealed (Market or hand). Set it aside; the first one
 * starts an election phase right away. Later ones in the same phase only add to
 * the decree count. Turn order never changes.
 */
export function noteGeneralElection(
  state: GameState,
  card: CardInstance,
  events: GameEvent[],
): void {
  state.electionsOut.push({ ...card, faceUp: true });
  events.push({ type: "electionSetAside", cardId: card.cardId });
  state.election.generalElections += 1;
  if (state.election.active) return;
  state.election.active = true;
  state.election.needsOpening = true;
  events.push({ type: "electionStarted", player: state.activePlayer });
}

/** Next non-election card from the deck. General elections are set aside and replaced. */
export function drawNonElection(
  state: GameState,
  events: GameEvent[],
): CardInstance | null {
  while (state.deck.length > 0) {
    const card = state.deck.shift()!;
    if (getCard(card.cardId).kind === CardKind.Election) {
      noteGeneralElection(state, card, events);
      continue;
    }
    return { ...card, faceUp: true };
  }
  return null;
}

/** Fill the Market up to `size`, stopping early if an election phase opens mid-fill. */
function fillMarketTo(state: GameState, size: number, events: GameEvent[]): void {
  const added: string[] = [];
  while (state.market.length < size) {
    const card = drawNonElection(state, events);
    if (!card) break;
    state.market.push(card);
    added.push(card.cardId);
    if (state.election.needsOpening) break;
  }
  if (added.length > 0) {
    events.push({ type: "marketReplenished", cardIds: added });
  }
}

/** A newly started election phase fills the Market to 8, once (expansion: two rows). */
export function openElectionIfNeeded(state: GameState, events: GameEvent[]): void {
  if (!state.election.needsOpening) return;
  state.election.needsOpening = false;
  if (state.expansion) {
    openElectionRows(state, events);
    return;
  }
  fillMarketTo(state, ELECTION_MARKET_SIZE, events);
}

/** Income step 2 / after an election: back to 5. Never during an election phase. */
export function replenishMarket(state: GameState, events: GameEvent[]): void {
  if (state.expansion) {
    replenishExpansionMarket(state, events);
  } else if (!state.election.active) {
    fillMarketTo(state, MARKET_SIZE, events);
  }
  openElectionIfNeeded(state, events);
}

// --- Legacy & Diplomacy Market ----------------------------------------------------------
//
// The Market is one dense array. Outside an election it is one row of 5 spots;
// during one it is two rows of 5 (`expansion.rowBreak` splits them). Spots are
// preserved until the income-step collapse, which is why the "last 2 spots" checks
// read the snapshot taken at the start of the turn (`expansion.turnMarket` / `turnRows`).

/** Spots in a Market row. */
export const ROW_SPOTS = 5;

/** The Market's rows: one outside an election, two during one. */
export function marketRows(state: GameState): CardInstance[][] {
  const rowBreak = state.expansion?.rowBreak;
  if (rowBreak === null || rowBreak === undefined) return [state.market];
  return [state.market.slice(0, rowBreak), state.market.slice(rowBreak)];
}

function setRows(state: GameState, rows: CardInstance[][]): void {
  state.market = rows.flat();
  if (state.expansion) state.expansion.rowBreak = rows.length === 2 ? rows[0]!.length : null;
}

/** Take a card out of the Market, keeping the election rows aligned. */
export function removeFromMarket(state: GameState, instanceId: string): CardInstance {
  const index = state.market.findIndex((card) => card.instanceId === instanceId);
  if (index < 0) throw new Error(`Market does not contain ${instanceId}`);
  const [card] = state.market.splice(index, 1);
  const expansion = state.expansion;
  if (expansion && expansion.rowBreak !== null && index < expansion.rowBreak) expansion.rowBreak -= 1;
  return card!;
}

/** Non-event cards to the right of `instanceId` in its row, right now. */
export function liveEventCost(state: GameState, instanceId: string): number {
  for (const row of marketRows(state)) {
    const index = row.findIndex((card) => card.instanceId === instanceId);
    if (index >= 0) return row.slice(index + 1).filter((card) => !isEventCard(card)).length;
  }
  return 0;
}

/** "Cost of an event card remains the same during a turn from start to finish." */
export function eventCost(state: GameState, instanceId: string): number {
  return state.expansion?.eventCosts[instanceId] ?? liveEventCost(state, instanceId);
}

/** Start of a turn: remember the spots and fix each event's cost for the turn. */
export function snapshotMarket(state: GameState): void {
  const expansion = state.expansion;
  if (!expansion) return;
  expansion.turnMarket = state.market.map((card) => card.instanceId);
  const rows = marketRows(state);
  expansion.turnRows = rows.length === 2 ? [rows[0]!.map((c) => c.instanceId), rows[1]!.map((c) => c.instanceId)] : null;
  expansion.eventCosts = Object.fromEntries(
    state.market.filter(isEventCard).map((card) => [card.instanceId, liveEventCost(state, card.instanceId)]),
  );
}

function revealEvent(state: GameState, events: GameEvent[]): CardInstance | null {
  const card = state.expansion?.eventDeck.shift();
  if (!card) return null;
  events.push({ type: "eventRevealed", cardId: card.cardId });
  return { ...card, faceUp: true };
}

function boxEvents(state: GameState, cards: CardInstance[], events: GameEvent[]): void {
  if (cards.length === 0 || !state.expansion) return;
  state.expansion.box.push(...cards);
  events.push({ type: "eventsRemoved", cardIds: cards.map((card) => card.cardId), reason: "market" });
}

/** Events sitting in the last 2 of `spots` (instance ids) that are still in `row`. */
function lastTwoSpotEvents(row: CardInstance[], spots: readonly string[]): CardInstance[] {
  const lastTwo = new Set(spots.slice(ROW_SPOTS - 2));
  return row.filter((card) => isEventCard(card) && lastTwo.has(card.instanceId));
}

/** Fill a row with main-deck cards up to `size`. Stops if a General Election needs the rows rebuilt. */
function fillRow(state: GameState, row: CardInstance[], size: number, events: GameEvent[]): void {
  const added: string[] = [];
  while (row.length < size) {
    const card = drawNonElection(state, events);
    if (!card) break;
    row.push(card);
    added.push(card.cardId);
    if (state.election.needsOpening) break;
  }
  if (added.length > 0) events.push({ type: "marketReplenished", cardIds: added });
}

/**
 * Expansion income step 2.
 * Outside an election, if fewer than 5 cards: (1) events in the 2 right-most spots
 * leave the game, collapse; (2) under 2 events, reveal one into the next spot;
 * (3) fill from the main deck back to 5.
 * During an election: per row, events in its last 2 spots leave; a row without an
 * event gets one only if it would not land in the row's last 2 spots. No main refill.
 */
function replenishExpansionMarket(state: GameState, events: GameEvent[]): void {
  const expansion = state.expansion!;
  if (state.election.active) {
    const rows = marketRows(state);
    // Rows formed this turn have no snapshot yet: nothing in them is old enough to leave.
    const spots = expansion.turnRows ?? [[], []];
    const next = rows.map((row, index) => {
      const gone = lastTwoSpotEvents(row, spots[index] ?? []);
      boxEvents(state, gone, events);
      const kept = row.filter((card) => !gone.includes(card));
      if (!kept.some(isEventCard) && kept.length < ROW_SPOTS - 2) {
        const event = revealEvent(state, events);
        if (event) kept.push(event);
      }
      return kept;
    });
    setRows(state, next.length === 2 ? next : [next[0]!, []]);
    return;
  }

  if (state.market.length >= ROW_SPOTS) return;
  const gone = lastTwoSpotEvents(state.market, expansion.turnMarket);
  boxEvents(state, gone, events);
  const row = state.market.filter((card) => !gone.includes(card));
  if (row.filter(isEventCard).length < 2) {
    const event = revealEvent(state, events);
    if (event) row.push(event);
  }
  fillRow(state, row, ROW_SPOTS, events);
  setRows(state, [row]);
}

/**
 * Expansion: an election phase splits the Market into two rows of 5.
 * Two events: the later one moves down to row 2 at the same spot; row 1 collapses
 * and refills, row 2 fills around the event. Otherwise each row without an event
 * fills to 4 and a new event takes its last spot. 8 main cards either way.
 */
function openElectionRows(state: GameState, events: GameEvent[]): void {
  const market = [...state.market];
  const marketEvents = market.filter(isEventCard);
  let row1: CardInstance[];
  let row2: CardInstance[];
  if (marketEvents.length >= 2) {
    const later = marketEvents[marketEvents.length - 1]!;
    const spot = Math.min(market.indexOf(later), ROW_SPOTS - 1);
    row1 = market.filter((card) => card !== later);
    fillRow(state, row1, ROW_SPOTS, events);
    const mains: CardInstance[] = [];
    fillRow(state, mains, ROW_SPOTS - 1, events);
    row2 = [...mains.slice(0, spot), later, ...mains.slice(spot)];
  } else {
    row1 = market;
    if (row1.some(isEventCard)) fillRow(state, row1, ROW_SPOTS, events);
    else withEventLast(state, row1, events);
    row2 = [];
    withEventLast(state, row2, events);
  }
  setRows(state, [row1, row2]);
}

function withEventLast(state: GameState, row: CardInstance[], events: GameEvent[]): void {
  fillRow(state, row, ROW_SPOTS - 1, events);
  const event = revealEvent(state, events);
  if (event) row.push(event);
  else fillRow(state, row, ROW_SPOTS, events);
}

/**
 * After an election resolves: "Replenish Market after, putting an Event card at the
 * last slot." Leftover events leave the game, the Market returns to one row of 4
 * main cards, and a new event takes the 5th spot. (Provisional reading; see open-questions.md.)
 */
export function resetMarketAfterElection(state: GameState, events: GameEvent[]): void {
  if (!state.expansion) return;
  boxEvents(state, state.market.filter(isEventCard), events);
  const row = state.market.filter((card) => !isEventCard(card));
  setRows(state, [row]);
  withEventLast(state, row, events);
  setRows(state, [row]);
}

/** Draw one card from the deck into a player's hand (General Elections handled). */
export function drawToHand(
  state: GameState,
  player: PlayerId,
  events: GameEvent[],
): CardInstance | null {
  const drawn = drawNonElection(state, events);
  if (drawn) {
    state.players[player].hand.push({ ...drawn, faceUp: false });
    events.push({ type: "cardDrawn", player, cardId: drawn.cardId });
  }
  openElectionIfNeeded(state, events);
  return drawn;
}
