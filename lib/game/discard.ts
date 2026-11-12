import { landingDistrict } from "./main.ts";
import { Phase, type CardInstance, type GameEvent, type GameState, type PlayerId } from "./types.ts";

/**
 * Move cards to support piles. Victories are declared, never automatic, so
 * discarding never ends the game by itself.
 */
export function discardCards(
  state: GameState,
  discarder: PlayerId,
  entries: readonly { card: CardInstance; owner: PlayerId }[],
  events: GameEvent[],
): void {
  for (const { card, owner } of entries) {
    const district = landingDistrict(card);
    const placed = { ...card, faceUp: true, occupiedDistrict: district };
    state.players[owner].support[district].push(placed);
    events.push({
      type: "cardDiscarded",
      player: discarder,
      instanceId: card.instanceId,
      cardId: card.cardId,
      district,
      pileOwner: owner,
    });
  }
}

export function discardOwn(
  state: GameState,
  player: PlayerId,
  cards: readonly CardInstance[],
  events: GameEvent[],
): void {
  discardCards(
    state,
    player,
    cards.map((card) => ({ card, owner: player })),
    events,
  );
}

export function gameIsOver(state: GameState): boolean {
  return state.phase === Phase.GameOver || state.victory !== null;
}
