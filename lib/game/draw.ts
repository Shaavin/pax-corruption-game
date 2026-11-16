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
//
// Cards flow left to right like a conveyor (Ian, 2026-11-16): new cards enter on the left,
// older cards slide right to close gaps, and a short row is right-aligned (its cards sit
// in the last spots). An event starts expensive (main cards to its right) and gets cheaper
// as it drifts right, until it leaves from the last 2 spots.

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

/** Events sitting in the last 2 of `spots` (instance ids, right-aligned) that are still in `row`. */
function lastTwoSpotEvents(row: CardInstance[], spots: readonly string[]): CardInstance[] {
  const lastTwo = new Set(spots.slice(-2));
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
 * Conveyor refill of one row: the older cards keep the right-hand spots; a new event (if
 * wanted) takes spot 1, and main-deck cards fill the gap between it and the older cards.
 * Never past 5 cards. Stops early if a General Election needs the rows rebuilt.
 */
function refillFromLeft(state: GameState, row: CardInstance[], wantEvent: boolean, events: GameEvent[]): CardInstance[] {
  const event = wantEvent && row.length < ROW_SPOTS ? revealEvent(state, events) : null;
  const mains: CardInstance[] = [];
  fillRow(state, mains, ROW_SPOTS - row.length - (event ? 1 : 0), events);
  return [...(event ? [event] : []), ...mains, ...row];
}

/**
 * Expansion income step 2.
 * Outside an election, whatever the Market holds: (1) events that sat in the 2 right-most
 * spots at the start of the turn leave the game, the rest slide right; (2) under 2 events
 * and room left, a new event takes spot 1; (3) main cards fill the gap, never past 5.
 * During an election: per row, events in its last 2 spots leave; a row without an
 * event gets one on its left only if it would not land in the row's last 2 spots
 * (the row holds at least 2 cards). No main refill.
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
      // Entering on the left of k right-aligned cards lands in spot 5 − k: the last 2 when k < 2.
      if (!kept.some(isEventCard) && kept.length >= 2 && kept.length < ROW_SPOTS) {
        const event = revealEvent(state, events);
        if (event) return [event, ...kept];
      }
      return kept;
    });
    setRows(state, next.length === 2 ? next : [next[0]!, []]);
    return;
  }

  // Every income, however full the Market is (Joe, 2026-11-15): check, collapse, refill to 5.
  const gone = lastTwoSpotEvents(state.market, expansion.turnMarket);
  boxEvents(state, gone, events);
  const row = state.market.filter((card) => !gone.includes(card));
  setRows(state, [refillFromLeft(state, row, row.filter(isEventCard).length < 2, events)]);
}

/**
 * Expansion: an election phase splits the Market into two rows of 5.
 * Two events: the later (left-most) one drops to the same spot of row 2; nothing else
 * moves, and the open spots of both rows fill in place. Otherwise each row refills like the
 * conveyor: a row without an event gets a new one in spot 1, and main cards fill the gap.
 * 8 main cards either way.
 */
function openElectionRows(state: GameState, events: GameEvent[]): void {
  const market = [...state.market];
  const marketEvents = market.filter(isEventCard);
  let row1: CardInstance[];
  let row2: CardInstance[];
  if (marketEvents.length >= 2) {
    // Ian, 2026-11-15: the event that came later (the left-most one) drops into the same
    // spot of row 2. Nothing else moves: the gap it leaves in row 1 and every other open
    // spot fill from the main deck in place.
    const later = marketEvents[0]!;
    // A short row is right-aligned: its first card sits in spot 5 − length.
    const offset = Math.max(0, ROW_SPOTS - market.length);
    const spot = Math.min(offset + market.indexOf(later), ROW_SPOTS - 1);
    const slots1: (CardInstance | null)[] = [
      ...Array.from({ length: offset }, () => null),
      ...market.map((card) => (card === later ? null : card)),
    ];
    const slots2: (CardInstance | null)[] = Array.from({ length: ROW_SPOTS }, (_, index) => (index === spot ? later : null));
    fillSlots(state, slots1, events);
    fillSlots(state, slots2, events);
    row1 = slots1.filter((card): card is CardInstance => card !== null);
    row2 = slots2.filter((card): card is CardInstance => card !== null);
  } else {
    row1 = refillFromLeft(state, market, !market.some(isEventCard), events);
    row2 = refillFromLeft(state, [], true, events);
  }
  setRows(state, [row1, row2]);
}

/** Fill the open spots of a row in place (up to 5), left to right, from the main deck. */
function fillSlots(state: GameState, slots: (CardInstance | null)[], events: GameEvent[]): void {
  while (slots.length < ROW_SPOTS) slots.push(null);
  const added: string[] = [];
  for (let index = 0; index < slots.length; index++) {
    if (slots[index] !== null) continue;
    const card = drawNonElection(state, events);
    if (!card) break;
    slots[index] = card;
    added.push(card.cardId);
  }
  if (added.length > 0) events.push({ type: "marketReplenished", cardIds: added });
}

/**
 * After an election resolves (Ian, 2026-11-15): nothing at all stays in the Market. Leftover
 * events leave the game, the rows merge back into one empty row, and the caller then
 * refills it like any income refill (`replenishMarket`).
 */
export function resetMarketAfterElection(state: GameState, events: GameEvent[]): void {
  if (!state.expansion) return;
  boxEvents(state, state.market.filter(isEventCard), events);
  setRows(state, [state.market.filter((card) => !isEventCard(card))]);
  // No spot from the election rows counts toward the "last 2 spots" check.
  state.expansion.turnMarket = [];
  state.expansion.turnRows = null;
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
