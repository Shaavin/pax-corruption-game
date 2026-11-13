import { EffectId } from "../cards/effects.ts";
import { District, MonumentId } from "../cards/schema.ts";
import { handLimit, hasActiveAlliance, ownsMonument } from "./abilities.ts";
import { drawToHand, removeFromMarket, replenishMarket } from "./draw.ts";
import { affordableEvents } from "./events.ts";
import { finishTurn } from "./election.ts";
import { Phase, type Continuation, type GameEvent, type GameState, type PlayerId } from "./types.ts";
import { marketNonEvents } from "./world.ts";

export function handSize(state: GameState, player: PlayerId): number {
  return state.players[player].hand.length;
}

export function underHandLimit(state: GameState, player: PlayerId): boolean {
  return state.players[player].hand.length < handLimit(state, player);
}

/**
 * Hook so the engine can say whether the active player still has a free action
 * to take after their main action (set by engine.ts to avoid an import cycle).
 */
let freeActionsAvailable: (state: GameState) => boolean = () => false;
export function setFreeActionCheck(check: (state: GameState) => boolean): void {
  freeActionsAvailable = check;
}

/**
 * Move the turn on to `next`, unless a choice is pending: then remember where
 * to resume, and `resumeAfterChoice` picks it up once the queue is empty.
 */
export function proceed(state: GameState, next: Continuation, events: GameEvent[]): void {
  if (state.phase === Phase.GameOver) return;
  if (state.pending.length > 0) {
    state.resume = next;
    return;
  }
  run(state, next, events);
}

export function resumeAfterChoice(state: GameState, events: GameEvent[]): void {
  if (state.pending.length > 0 || state.resume === null) return;
  const next = state.resume;
  state.resume = null;
  run(state, next, events);
}

function run(state: GameState, next: Continuation, events: GameEvent[]): void {
  switch (next) {
    case "action":
      return;
    case "afterMain":
      // Stay in the action step while a free action is still available.
      if (freeActionsAvailable(state)) return;
      enterPolitics(state, events);
      return;
    case "afterFree":
      if (state.turn.mainActionDone && !freeActionsAvailable(state)) enterPolitics(state, events);
      return;
    case "politics":
      enterPolitics(state, events);
      return;
    case "income":
      beginIncome(state, events);
      return;
    case "incomeDraw":
      incomeDraw(state, events);
      return;
    case "incomeEnd":
      incomeEnd(state, events);
      return;
  }
}

/** The main action is done: free actions may follow, then Politics. */
export function afterMainAction(state: GameState, events: GameEvent[]): void {
  state.turn.mainActionDone = true;
  proceed(state, "afterMain", events);
}

/** Politics starts with a draw if a monument was constructed this turn. */
export function enterPolitics(state: GameState, events: GameEvent[]): void {
  if (state.phase === Phase.GameOver) return;
  state.turn.mainActionDone = true;
  state.phase = Phase.Politics;
  events.push({ type: "politicsStarted", player: state.activePlayer });
  if (state.turn.constructedMonument) {
    state.turn.constructedMonument = false;
    drawToHand(state, state.activePlayer, events);
  }
}

/** Income step 1: under the limit, take one Market card (a choice); otherwise skip ahead. */
export function beginIncome(state: GameState, events: GameEvent[]): void {
  if (state.phase === Phase.GameOver) return;
  // Kybernetik Inc.: no income at all, so no Market refill or draws either.
  if (state.turn.skipIncome) {
    finishTurn(state, events);
    return;
  }
  const player = state.activePlayer;
  if (underHandLimit(state, player) && hasIncomeChoice(state, player)) {
    state.phase = Phase.Income;
    events.push({ type: "incomeStarted", player });
    return;
  }
  completeIncome(state, events);
}

/** Something to do at income: a non-event Market card, or (expansion) an event to buy. */
function hasIncomeChoice(state: GameState, player: PlayerId): boolean {
  if (marketNonEvents(state).length > 0) return true;
  // Only events left: worth stopping only if one is affordable.
  return affordableEvents(state, player).length > 0;
}

export function takeMarketCard(state: GameState, instanceId: string, events: GameEvent[]): void {
  const player = state.activePlayer;
  const card = removeFromMarket(state, instanceId);
  state.players[player].hand.push({ ...card, faceUp: true });
  events.push({ type: "marketTaken", player, instanceId: card.instanceId, cardId: card.cardId });
  completeIncome(state, events);
}

/** Income step 2: refill the Market to 5 (not during an election), then the draw. */
export function completeIncome(state: GameState, events: GameEvent[]): void {
  replenishMarket(state, events);
  proceed(state, "incomeDraw", events);
}

/** People's Press can swap the deck draw for a card from your Smarbbit support pile. */
export function canUsePeoplesPress(state: GameState, player: PlayerId): boolean {
  return (
    hasActiveAlliance(state, player, EffectId.DrawFromOwnSupportPile, District.Smarbbit) &&
    state.players[player].support[District.Smarbbit].length > 0
  );
}

/** Income step 3: draw if still under the hand limit. */
function incomeDraw(state: GameState, events: GameEvent[]): void {
  const player = state.activePlayer;
  if (underHandLimit(state, player)) {
    if (canUsePeoplesPress(state, player)) {
      state.pending.push({ kind: "peoplesPress", player });
      proceed(state, "incomeEnd", events);
      return;
    }
    drawToHand(state, player, events);
  }
  proceed(state, "incomeEnd", events);
}

/** Dragon Gate's extra draw, then the turn ends. */
function incomeEnd(state: GameState, events: GameEvent[]): void {
  const player = state.activePlayer;
  // Dragon Gate: "Draw a card at the end of income step if you have exactly 4 cards."
  if (ownsMonument(state, player, MonumentId.DragonGate) && state.players[player].hand.length === 4) {
    drawToHand(state, player, events);
  }
  finishTurn(state, events);
}
