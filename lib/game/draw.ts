import { getCard } from "../cards/catalog.ts";
import { CardKind } from "../cards/schema.ts";
import { Phase, type CardInstance, type GameEvent, type GameState } from "./types.ts";

export const MARKET_SIZE = 5;
export const ELECTION_MARKET_SIZE = 8;

export function shouldSkipReplenish(state: GameState): boolean {
  return state.election.active || state.election.skipReplenish;
}

/**
 * Set aside a general election. The first one while no election is running
 * (or pending) marks the active player as triggerer and queues start-of-phase.
 */
export function noteGeneralElection(state: GameState, events: GameEvent[]): void {
  if (state.election.active || state.election.pendingStart) return;
  state.electionTriggerer = state.activePlayer;
  state.election.pendingStart = true;
  events.push({ type: "electionTriggered", player: state.activePlayer });
}

/** Next non-election card from the deck. General elections are set aside and replaced. */
export function drawNonElection(
  state: GameState,
  events: GameEvent[],
): CardInstance | null {
  while (state.deck.length > 0) {
    const card = state.deck.shift()!;
    if (getCard(card.cardId).kind === CardKind.Election) {
      state.electionsOut.push({ ...card, faceUp: true });
      events.push({ type: "electionSetAside", cardId: card.cardId });
      noteGeneralElection(state, events);
      continue;
    }
    return { ...card, faceUp: true };
  }
  return null;
}

export function fillMarket(
  state: GameState,
  size: number,
  events: GameEvent[],
): void {
  if (state.phase === Phase.GameOver) return;
  const added: string[] = [];
  while (state.market.length < size) {
    const card = drawNonElection(state, events);
    if (!card) break;
    state.market.push(card);
    added.push(card.cardId);
  }
  if (added.length > 0) {
    events.push({ type: "marketReplenished", cardIds: added });
  }
}
