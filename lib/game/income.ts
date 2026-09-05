import { drawNonElection, fillMarket, MARKET_SIZE, shouldSkipReplenish } from "./draw.ts";
import { finishTurn } from "./election.ts";
import { Phase, type GameEvent, type GameState, type PlayerId } from "./types.ts";

export function handSize(state: GameState, player: PlayerId): number {
  return state.players[player].hand.length;
}

export function underHandLimit(state: GameState, player: PlayerId): boolean {
  const seat = state.players[player];
  return seat.hand.length < seat.handLimit;
}

/** After the mandatory main action: Politics (skippable), then income. */
export function afterMainAction(state: GameState, events: GameEvent[]): void {
  if (state.phase === Phase.GameOver) return;
  state.phase = Phase.Politics;
  events.push({ type: "politicsStarted", player: state.activePlayer });
}

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

export function completeIncome(state: GameState, events: GameEvent[]): void {
  const player = state.activePlayer;
  if (underHandLimit(state, player)) {
    const drawn = drawNonElection(state, events);
    if (drawn) {
      state.players[player].hand.push({ ...drawn, faceUp: false });
      events.push({ type: "cardDrawn", player, cardId: drawn.cardId });
    }
  }
  if (!shouldSkipReplenish(state)) {
    fillMarket(state, MARKET_SIZE, events);
  }
  finishTurn(state, events);
}

export function replenishMarket(state: GameState, events: GameEvent[]): void {
  fillMarket(state, MARKET_SIZE, events);
}
