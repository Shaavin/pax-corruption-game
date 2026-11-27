/**
 * What a monument costs, and Fund a monument (Joe, 2026-11-26): the fourth Politics option.
 * Tuck one card of a monument's district under that available monument. Funding isn't
 * exclusive: each tucked card lowers the monument's cost by 1 for both players, never below 1
 * (so at most 4 under a 5-card monument). Whoever builds it discards the tucked cards with their
 * own, to their support piles. A monument doesn't need funding to be built.
 */
import type { DistrictId } from "../cards/schema.ts";
import { martialLawBlocks } from "./abilities.ts";
import { getCard } from "../cards/catalog.ts";
import { CONSTRUCT_COST, handCardsInDistrict, handLikeCards, printedDistrict, takeHandLike } from "./main.ts";
import type { CardInstance, FundMonumentAction, GameEvent, GameState, PlayerId } from "./types.ts";
import { IllegalActionError } from "./errors.ts";

/** The cards tucked under an available monument. */
export function fundedCards(state: GameState, monumentInstanceId: string): CardInstance[] {
  // Older saved states have no funding at all.
  return state.funding?.[monumentInstanceId] ?? [];
}

/** Cards of its district it takes to build an available monument now. */
export function monumentCost(state: GameState, monumentInstanceId: string): number {
  return Math.max(1, CONSTRUCT_COST - fundedCards(state, monumentInstanceId).length);
}

/**
 * Why `player` can't build this monument with these cards (null: they can). Each card must be of
 * the monument's district, or of the `wild` one (Architecture Inc.), and there must be exactly
 * as many as it costs now. Martial Law counts the tucked cards, discarded with the builder's.
 */
export function constructIssue(
  state: GameState,
  player: PlayerId,
  instanceIds: readonly string[],
  monumentInstanceId: string,
  wild?: DistrictId,
): string | null {
  const monument = state.availableMonuments.find((entry) => entry.instanceId === monumentInstanceId);
  if (!monument) return "That monument is not available";
  const district = printedDistrict(monument.cardId);
  const cost = monumentCost(state, monumentInstanceId);
  if (instanceIds.length !== cost) return `That monument takes ${cost} card${cost === 1 ? "" : "s"} now`;
  if (new Set(instanceIds).size !== instanceIds.length) return "Spend cards must be unique";
  const available = handLikeCards(state, player, { market: true });
  const spent: CardInstance[] = [];
  for (const id of instanceIds) {
    const card = available.find((entry) => entry.instanceId === id);
    if (!card) return "Spend cards from your hand";
    const printed = printedDistrict(card.cardId);
    if (printed !== district && printed !== wild) return "Monument district must match the cards spent";
    spent.push(card);
  }
  if (martialLawBlocks(state, [...spent, ...fundedCards(state, monumentInstanceId)].map((card) => printedDistrict(card.cardId)))) {
    return "Martial Law: actions may discard at most 1 Shavvinne card";
  }
  return null;
}

/**
 * Why `player` can't build any monument as a main action, or null: some available monument has
 * at least its cost (5, less 1 per card funding it) in cards of its district in their hand.
 */
export function constructBlockReason(state: GameState, player: PlayerId): string | null {
  if (state.availableMonuments.length === 0) return "No monument is available to build";
  let closest: { name: string; cost: number; have: number } | null = null;
  for (const monument of state.availableMonuments) {
    const cost = monumentCost(state, monument.instanceId);
    const have = handCardsInDistrict(state, player, printedDistrict(monument.cardId)).length;
    if (have >= cost) return null;
    if (!closest || cost - have < closest.cost - closest.have) closest = { name: getCard(monument.cardId).name, cost, have };
  }
  const { name, cost, have } = closest!;
  return `${name} takes ${cost} cards of its district (5, less 1 per card funding it); you have ${have}`;
}

/** Whether another card may be tucked under it (not when that would make it free). */
export function canFund(state: GameState, monumentInstanceId: string): boolean {
  return monumentCost(state, monumentInstanceId) > 1;
}

/** Every Fund a monument move `player` has: each matching card under each monument that takes one. */
export function fundOptions(state: GameState, player: PlayerId): FundMonumentAction[] {
  const actions: FundMonumentAction[] = [];
  const cards = handLikeCards(state, player, { market: true });
  for (const monument of state.availableMonuments) {
    if (!canFund(state, monument.instanceId)) continue;
    const district = printedDistrict(monument.cardId);
    for (const card of cards) {
      if (printedDistrict(card.cardId) === district) {
        actions.push({ type: "fundMonument", player, instanceId: card.instanceId, monumentInstanceId: monument.instanceId });
      }
    }
  }
  return actions;
}

/** Tuck a card from `player`'s hand under an available monument of its district. */
export function fundMonument(
  state: GameState,
  player: PlayerId,
  instanceId: string,
  monumentInstanceId: string,
  events: GameEvent[],
): void {
  const monument = state.availableMonuments.find((entry) => entry.instanceId === monumentInstanceId);
  if (!monument) throw new IllegalActionError("That monument is not available");
  if (!canFund(state, monumentInstanceId)) {
    throw new IllegalActionError("That monument already costs only 1: it can't be funded further");
  }
  const card = handLikeCards(state, player, { market: true }).find((entry) => entry.instanceId === instanceId);
  if (!card) throw new IllegalActionError("Fund a monument with a card from your hand");
  if (printedDistrict(card.cardId) !== printedDistrict(monument.cardId)) {
    throw new IllegalActionError("Fund a monument with a card of its district");
  }
  const tucked = { ...takeHandLike(state, player, instanceId, { market: true }), faceUp: true };
  state.funding ??= {};
  (state.funding[monumentInstanceId] ??= []).push(tucked);
  events.push({
    type: "monumentFunded",
    player,
    instanceId: tucked.instanceId,
    cardId: tucked.cardId,
    monumentInstanceId,
    monumentCardId: monument.cardId,
    cost: monumentCost(state, monumentInstanceId),
  });
}
