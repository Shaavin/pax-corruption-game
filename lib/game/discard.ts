import { MonumentId } from "../cards/schema.ts";
import { ownsMonument, unitedFrontRedirect } from "./abilities.ts";
import { landingDistrict } from "./main.ts";
import { otherPlayer } from "./zones.ts";
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
  opts: { reroutable?: boolean } = {},
): void {
  for (const { card, owner } of entries) {
    const district = landingDistrict(card);
    const placed = { ...card, faceUp: true, occupiedDistrict: district };
    // United Front: a card discarded to Smarbbit goes to the non-discarding player's pile.
    const pileOwner = unitedFrontRedirect(state, district) ? otherPlayer(discarder) : owner;
    state.players[pileOwner].support[district].push(placed);
    events.push({
      type: "cardDiscarded",
      player: discarder,
      instanceId: card.instanceId,
      cardId: card.cardId,
      district,
      pileOwner,
    });
  }
  // Space Agency: the discarder may move their own just-discarded cards to other piles.
  const own = entries.filter((entry) => entry.owner === discarder).map((entry) => entry.card.instanceId);
  if ((opts.reroutable ?? true) && own.length > 0 && ownsMonument(state, discarder, MonumentId.SpaceAgency)) {
    state.pending.push({ kind: "routeDiscards", player: discarder, instanceIds: own });
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
