import { drawToHand, replenishMarket } from "./draw.ts";
import { finishTurn } from "./election.ts";
import { Phase, type GameEvent, type GameState, type PlayerId } from "./types.ts";

export function handSize(state: GameState, player: PlayerId): number {
  return state.players[player].hand.length;
}

export function underHandLimit(state: GameState, player: PlayerId): boolean {
  const seat = state.players[player];
  return seat.hand.length < seat.handLimit;
}

/**
 * After the mandatory main action: the Politics step. If a monument was
 * constructed this turn, it starts with a draw.
 */
export function afterMainAction(state: GameState, events: GameEvent[]): void {
  if (state.phase === Phase.GameOver) return;
  state.phase = Phase.Politics;
  events.push({ type: "politicsStarted", player: state.activePlayer });
  if (state.turn.constructedMonument) {
    drawToHand(state, state.activePlayer, events);
  }
}

/** Income step 1: under the limit, take one Market card (a choice); otherwise skip ahead. */
export function beginIncome(state: GameState, events: GameEvent[]): void {
  if (state.phase === Phase.GameOver) return;
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

/**
 * Income steps 2–3: replenish the Market to 5 (skipped during an election
 * phase), then draw from the deck if still under the hand limit.
 */
export function completeIncome(state: GameState, events: GameEvent[]): void {
  const player = state.activePlayer;
  replenishMarket(state, events);
  if (underHandLimit(state, player)) {
    drawToHand(state, player, events);
  }
  finishTurn(state, events);
}
