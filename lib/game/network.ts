/**
 * Network (rules update 2026-11-18, Joe via Ian): a voluntarily revealed part of
 * your hand that does not count toward the hand limit. Disabled by default; an
 * ability enables it for one district, and only cards of that district can sit
 * there. A network is exclusive to its ability's owner unless the card says
 * "both players". During your own turn you may move cards in and out freely.
 * When a network is disabled, its cards bounce back to the hand, even past the
 * hand limit (no discard; you just can't take or draw until under it).
 *
 * Enabled by: Consultative Office (Smarbbit policy, both players), Planet Next
 * (its owner, Horsard), and the East events (their buyer, or both players for a
 * Foreign Influence setup event).
 */
import { MonumentId, PolicyId, DISTRICTS, type DistrictId } from "../cards/schema.ts";
import { getCard } from "../cards/catalog.ts";
import { ownsMonument, policyActive } from "./abilities.ts";
import { IllegalActionError } from "./errors.ts";
import { Phase, type CardInstance, type GameEvent, type GameState, type NetworkAction, type PlayerId } from "./types.ts";
import { eastNetworkDistricts } from "./world.ts";

function districtOf(cardId: string): DistrictId | null {
  const def = getCard(cardId);
  return "district" in def ? def.district : null;
}

/** Districts whose network is enabled for `player` right now. */
export function networkDistricts(state: GameState, player: PlayerId): DistrictId[] {
  const enabled = new Set<DistrictId>(eastNetworkDistricts(state, player));
  // Consultative Office: "The network is enabled for both players in Smarbbit."
  if (policyActive(state, PolicyId.SmarbbitB)) enabled.add("smarbbit");
  // Planet Next: "You enable network in Horsard."
  if (ownsMonument(state, player, MonumentId.PlanetNext)) enabled.add("horsard");
  return DISTRICTS.filter((district) => enabled.has(district));
}

export function networkEnabled(state: GameState, player: PlayerId, district: DistrictId): boolean {
  return networkDistricts(state, player).includes(district);
}

/** Cards in `player`'s network for one district. */
export function networkCards(state: GameState, player: PlayerId, district: DistrictId): CardInstance[] {
  return state.players[player].network.filter((card) => districtOf(card.cardId) === district);
}

/** "At any time during their turn": own action, politics, or income step, with no choice pending. */
function canMoveNow(state: GameState, player: PlayerId): boolean {
  return (
    state.activePlayer === player &&
    state.pending.length === 0 &&
    state.victory === null &&
    (state.phase === Phase.Action || state.phase === Phase.Politics || state.phase === Phase.Income)
  );
}

/** One action per card: hand → network (enabled districts), network → hand. */
export function networkActions(state: GameState, player: PlayerId): NetworkAction[] {
  if (!canMoveNow(state, player)) return [];
  const seat = state.players[player];
  const districts = new Set(networkDistricts(state, player));
  const into = seat.hand
    .filter((card) => {
      const district = districtOf(card.cardId);
      return district !== null && districts.has(district);
    })
    .map((card) => ({ type: "toNetwork" as const, player, instanceIds: [card.instanceId] }));
  const out = seat.network.map((card) => ({ type: "fromNetwork" as const, player, instanceIds: [card.instanceId] }));
  return [...into, ...out];
}

export function applyNetworkMove(state: GameState, action: NetworkAction, events: GameEvent[]): void {
  if (!canMoveNow(state, action.player)) {
    throw new IllegalActionError("You can move cards in or out of your network only during your own turn");
  }
  const seat = state.players[action.player];
  const ids = new Set(action.instanceIds);
  if (ids.size === 0) throw new IllegalActionError("Pick a card to move");
  if (action.type === "toNetwork") {
    const districts = new Set(networkDistricts(state, action.player));
    const cards = seat.hand.filter((card) => ids.has(card.instanceId));
    if (cards.length !== ids.size) throw new IllegalActionError("Only cards from your hand can go into your network");
    for (const card of cards) {
      const district = districtOf(card.cardId);
      if (district === null || !districts.has(district)) {
        throw new IllegalActionError("That card's district has no network enabled for you");
      }
    }
    seat.hand = seat.hand.filter((card) => !ids.has(card.instanceId));
    seat.network.push(...cards.map((card) => ({ ...card, faceUp: true })));
    events.push({ type: "networkMoved", player: action.player, direction: "in", cardIds: cards.map((card) => card.cardId) });
  } else {
    const cards = seat.network.filter((card) => ids.has(card.instanceId));
    if (cards.length !== ids.size) throw new IllegalActionError("That card is not in your network");
    seat.network = seat.network.filter((card) => !ids.has(card.instanceId));
    // Still face up: the opponent has seen it.
    seat.hand.push(...cards);
    events.push({ type: "networkMoved", player: action.player, direction: "out", cardIds: cards.map((card) => card.cardId) });
  }
}

/**
 * After every action: cards whose district's network is no longer enabled for
 * their owner go back to the hand, even past the hand limit.
 */
export function syncNetworks(state: GameState, events: GameEvent[]): void {
  for (const player of [0, 1] as const) {
    const seat = state.players[player];
    if (seat.network.length === 0) continue;
    const districts = new Set(networkDistricts(state, player));
    const back = seat.network.filter((card) => {
      const district = districtOf(card.cardId);
      return district === null || !districts.has(district);
    });
    if (back.length === 0) continue;
    seat.network = seat.network.filter((card) => !back.includes(card));
    seat.hand.push(...back);
    events.push({ type: "networkReturned", player, cardIds: back.map((card) => card.cardId) });
  }
}
