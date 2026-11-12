import { getCard } from "../cards/catalog.ts";
import { CardKind } from "../cards/schema.ts";
import type { CardInstance, GameEvent, GameState, PlayerId } from "./types.ts";

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

/** A newly started election phase fills the Market to 8, once. */
export function openElectionIfNeeded(state: GameState, events: GameEvent[]): void {
  if (!state.election.needsOpening) return;
  state.election.needsOpening = false;
  fillMarketTo(state, ELECTION_MARKET_SIZE, events);
}

/** Income step 2 / after an election: back to 5. Never during an election phase. */
export function replenishMarket(state: GameState, events: GameEvent[]): void {
  if (!state.election.active) {
    fillMarketTo(state, MARKET_SIZE, events);
  }
  openElectionIfNeeded(state, events);
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
