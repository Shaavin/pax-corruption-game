import { getCard } from "../cards/catalog.ts";
import { CardKind } from "../cards/schema.ts";
import { Phase, type CardInstance, type GameEvent, type GameState, type PlayerId } from "./types.ts";
import { otherPlayer } from "./zones.ts";

export const MARKET_SIZE = 5;

export function handSize(state: GameState, player: PlayerId): number {
  return state.players[player].hand.length;
}

export function underHandLimit(state: GameState, player: PlayerId): boolean {
  const seat = state.players[player];
  return seat.hand.length < seat.handLimit;
}

/**
 * Next non-election card from the deck. General elections are set aside and
 * replaced. Election-phase trigger is Phase 5 — dummy turns keep going.
 */
export function drawNonElection(
  state: GameState,
  events: GameEvent[],
): CardInstance | null {
  while (state.deck.length > 0) {
    const card = state.deck.shift()!;
    if (getCard(card.cardId).kind === CardKind.Election) {
      state.electionsOut.push({ ...card, faceUp: true });
      events.push({ type: "electionSetAside", cardId: card.cardId });
      continue;
    }
    return { ...card, faceUp: true };
  }
  return null;
}

/** Politics is skippable; campaign / EP arrive in later phases. */
export function afterMainAction(state: GameState, events: GameEvent[]): void {
  beginIncome(state, events);
}

export function beginIncome(state: GameState, events: GameEvent[]): void {
  const player = state.activePlayer;
  if (underHandLimit(state, player) && state.market.length > 0) {
    state.phase = Phase.Income;
    events.push({ type: "incomeStarted", player });
    return;
  }
  completeIncome(state, events);
}

export function takeMarketCard(
  state: GameState,
  instanceId: string,
  events: GameEvent[],
): void {
  const player = state.activePlayer;
  const index = state.market.findIndex((card) => card.instanceId === instanceId);
  if (index < 0) {
    throw new Error(`Market does not contain ${instanceId}`);
  }
  const card = state.market.splice(index, 1)[0]!;
  state.players[player].hand.push({ ...card, faceUp: true });
  events.push({
    type: "marketTaken",
    player,
    instanceId: card.instanceId,
    cardId: card.cardId,
  });
  completeIncome(state, events);
}

export function completeIncome(state: GameState, events: GameEvent[]): void {
  const player = state.activePlayer;
  if (underHandLimit(state, player)) {
    const drawn = drawNonElection(state, events);
    if (drawn) {
      state.players[player].hand.push({ ...drawn, faceUp: false });
      events.push({ type: "cardDrawn", player, cardId: drawn.cardId });
    }
  }
  replenishMarket(state, events);
  passTurn(state, events);
}

export function replenishMarket(state: GameState, events: GameEvent[]): void {
  const added: string[] = [];
  while (state.market.length < MARKET_SIZE) {
    const card = drawNonElection(state, events);
    if (!card) break;
    state.market.push(card);
    added.push(card.cardId);
  }
  if (added.length > 0) {
    events.push({ type: "marketReplenished", cardIds: added });
  }
}

export function passTurn(state: GameState, events: GameEvent[]): void {
  state.lastTurn = { discarded: false, addedSupport: false };
  state.flags = {};
  state.activePlayer = otherPlayer(state.activePlayer);
  state.phase = Phase.Action;
  events.push({ type: "turnEnded", nextPlayer: state.activePlayer });
}
