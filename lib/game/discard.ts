import { getCard } from "../cards/catalog.ts";
import { CardKind, DISTRICTS, MonumentId, type DistrictId } from "../cards/schema.ts";
import { allianceLimit, ownsMonument, unitedFrontRedirect } from "./abilities.ts";
import { landingDistrict } from "./main.ts";
import { otherPlayer } from "./zones.ts";
import { isEventCard } from "./world.ts";
import { Phase, type CardInstance, type GameEvent, type GameState, type PlayerId } from "./types.ts";

/**
 * Move cards to support piles. Victories are declared, never automatic, so
 * discarding never ends the game by itself.
 */
export function discardCards(
  state: GameState,
  discarder: PlayerId,
  allEntries: readonly { card: CardInstance; owner: PlayerId }[],
  events: GameEvent[],
  opts: { reroutable?: boolean } = {},
): void {
  let entries = allEntries;
  const boxed = entries.filter(({ card }) => isEventCard(card));
  if (boxed.length > 0 && state.expansion) {
    // Ruled 2026-11-11: a discarded event goes back to the box, never to a support pile.
    state.expansion.box.push(...boxed.map(({ card }) => ({ ...card, faceUp: true, occupiedDistrict: undefined })));
    events.push({ type: "eventsRemoved", cardIds: boxed.map(({ card }) => card.cardId), reason: "discard" });
  }
  entries = entries.filter(({ card }) => !isEventCard(card));
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
  // Space Academy: the discarder may move one of their own just-discarded cards to another pile.
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

/**
 * Alliance limit (ruled 2026-11-18, Joe via Ian): when a player's alliance limit
 * drops below the alliances in one of their lanes (Martial Law passed), they
 * discard down to the limit at once, to their own support piles. When some may
 * stay (Model Society), the owner picks which go. Monuments are never lost, so
 * Martial Law is the only way a limit drops.
 */
export function enforceAllianceLimits(state: GameState, events: GameEvent[]): void {
  for (const player of [0, 1] as const) {
    for (const district of DISTRICTS) {
      const alliances = state.players[player].tableau[district].filter(
        (card) => getCard(card.cardId).kind === CardKind.Alliance,
      );
      const limit = allianceLimit(state, player, district);
      if (alliances.length <= limit) continue;
      if (state.pending.some((choice) => choice.kind === "trimAlliances" && choice.player === player && choice.district === district)) {
        continue;
      }
      if (limit === 0) discardAlliances(state, player, district, alliances, events);
      else state.pending.push({ kind: "trimAlliances", player, district, count: alliances.length - limit });
    }
  }
}

/** Discard some of `player`'s alliances in `district`'s lane for the alliance limit. */
export function discardAlliances(
  state: GameState,
  player: PlayerId,
  district: DistrictId,
  cards: readonly CardInstance[],
  events: GameEvent[],
): void {
  const seat = state.players[player];
  const ids = new Set(cards.map((card) => card.instanceId));
  seat.tableau[district] = seat.tableau[district].filter((card) => !ids.has(card.instanceId));
  events.push({
    type: "alliancesOverLimit",
    player,
    district,
    limit: allianceLimit(state, player, district),
    cardIds: cards.map((card) => card.cardId),
  });
  // The owner discards them, so Space Academy may route one, like any discard of theirs.
  discardOwn(state, player, cards, events);
}

export function gameIsOver(state: GameState): boolean {
  return state.phase === Phase.GameOver || state.victory !== null;
}
