import { landingDistrict } from "./main.ts";
import { Phase, type CardInstance, type GameEvent, type GameState, type PlayerId } from "./types.ts";
import { resolveVictory } from "./victory.ts";

export function discardCards(
  state: GameState,
  discarder: PlayerId,
  entries: readonly { card: CardInstance; owner: PlayerId }[],
  events: GameEvent[],
): void {
  if (entries.length === 0) return;
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
  state.currentTurn.discarded = true;
  state.currentTurn.addedSupport = true;
  resolveVictory(state, events);
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
