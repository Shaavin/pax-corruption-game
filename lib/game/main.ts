import { getCard } from "../cards/catalog.ts";
import { EffectId } from "../cards/effects.ts";
import { CardKind, District, DISTRICTS, type DistrictId } from "../cards/schema.ts";
import { allianceLimit, hasActiveAlliance } from "./abilities.ts";
import type { CardInstance, GameState, PlayerId } from "./types.ts";
import { removeFromMarket } from "./draw.ts";
import { isEventCard, supportCount } from "./world.ts";

/** East "Revealed … cards do not occupy hand limit" zone (expansion), or an empty list. */
function revealedZone(state: GameState, player: PlayerId): CardInstance[] {
  return state.expansion ? state.expansion.revealed[player] : [];
}

export const RECRUIT_COST = 3;
export const CONSTRUCT_COST = 5;

export function printedDistrict(cardId: string): DistrictId {
  const def = getCard(cardId);
  switch (def.kind) {
    case CardKind.Civil:
    case CardKind.Alliance:
    case CardKind.Conspiracy:
    case CardKind.Monument:
    case CardKind.Policy:
      return def.district;
    default:
      throw new Error(`${cardId} has no printed district`);
  }
}

export function landingDistrict(card: CardInstance): DistrictId {
  return card.occupiedDistrict ?? printedDistrict(card.cardId);
}

export function allianceCount(state: GameState, player: PlayerId, district: DistrictId): number {
  return state.players[player].tableau[district].filter(
    (card) => getCard(card.cardId).kind === CardKind.Alliance,
  ).length;
}

export function canPlayAlliance(
  state: GameState,
  player: PlayerId,
  district: DistrictId,
): boolean {
  return allianceCount(state, player, district) < allianceLimit(state, player, district);
}

/**
 * Cards usable "as if in hand": the hand itself, the Consultative Office and
 * Planet Next zones, and — for main and free actions with State Enterprise —
 * Dragonara civil cards in the Market.
 */
export function handLikeCards(
  state: GameState,
  player: PlayerId,
  opts: { market: boolean },
): CardInstance[] {
  const seat = state.players[player];
  const cards = [...seat.hand, ...seat.consultativeOffice, ...seat.planetNextBank, ...revealedZone(state, player)];
  if (opts.market && hasActiveAlliance(state, player, EffectId.TreatMarketCivilAsHand, District.Dragonara)) {
    for (const card of state.market) {
      // Events can't be taken outside the income step (expansion rulebook).
      if (isEventCard(card)) continue;
      const def = getCard(card.cardId);
      if (def.kind === CardKind.Civil && def.district === District.Dragonara) cards.push(card);
    }
  }
  return cards;
}

/** Remove a card from wherever it sits among the hand-like zones. */
export function takeHandLike(
  state: GameState,
  player: PlayerId,
  instanceId: string,
  opts: { market: boolean },
): CardInstance {
  if (!handLikeCards(state, player, opts).some((card) => card.instanceId === instanceId)) {
    throw new Error("That card is not in your hand");
  }
  const seat = state.players[player];
  for (const zone of [seat.hand, seat.consultativeOffice, seat.planetNextBank, revealedZone(state, player)]) {
    const index = zone.findIndex((card) => card.instanceId === instanceId);
    if (index >= 0) return zone.splice(index, 1)[0]!;
  }
  if (state.market.some((card) => card.instanceId === instanceId)) return removeFromMarket(state, instanceId);
  throw new Error("That card is not in your hand");
}

/** Put a card back where it came from (used when a play turns out to be illegal). */
export function returnToHand(state: GameState, player: PlayerId, card: CardInstance): void {
  state.players[player].hand.push(card);
}

export function handCardsInDistrict(
  state: GameState,
  player: PlayerId,
  district: DistrictId,
): CardInstance[] {
  return handLikeCards(state, player, { market: true }).filter((card) => {
    const def = getCard(card.cardId);
    return def.kind !== CardKind.Election && "district" in def && def.district === district;
  });
}

export function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > items.length) return [];
  const result: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length === k) {
      result.push([...acc]);
      return;
    }
    for (let i = start; i <= items.length - (k - acc.length); i++) {
      acc.push(items[i]!);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return result;
}

/** Validate and remove `count` same-district cards from the hand-like zones (Market allowed). */
export function takeSpend(
  state: GameState,
  player: PlayerId,
  instanceIds: readonly string[],
  count: number,
): { cards: CardInstance[]; district: DistrictId } {
  if (instanceIds.length !== count) {
    throw new Error(`Expected ${count} cards, got ${instanceIds.length}`);
  }
  if (new Set(instanceIds).size !== instanceIds.length) {
    throw new Error("Spend cards must be unique");
  }
  const available = handLikeCards(state, player, { market: true });
  const cards = instanceIds.map((id) => {
    const card = available.find((entry) => entry.instanceId === id);
    if (!card) throw new Error(`Card ${id} is not in hand`);
    return card;
  });
  const districts = cards.map((card) => printedDistrict(card.cardId));
  const district = districts[0];
  if (!district || districts.some((entry) => entry !== district)) {
    throw new Error("Spend cards must share a printed district");
  }
  for (const id of instanceIds) takeHandLike(state, player, id, { market: true });
  return { cards, district };
}

export function sameDistrictCount(
  state: GameState,
  player: PlayerId,
  count: number,
): boolean {
  return DISTRICTS.some(
    (district) => handCardsInDistrict(state, player, district).length >= count,
  );
}

/** Rulebook: recruiting needs a card you already discarded in that district. */
export function canRecruitIn(state: GameState, player: PlayerId, district: DistrictId): boolean {
  return supportCount(state, player, district) > 0;
}

export function recruitBlockReason(state: GameState, player: PlayerId): string | null {
  const ready = DISTRICTS.some(
    (district) =>
      handCardsInDistrict(state, player, district).length >= RECRUIT_COST &&
      canRecruitIn(state, player, district),
  );
  if (ready) return null;
  if (!sameDistrictCount(state, player, RECRUIT_COST)) {
    return `Discard ${RECRUIT_COST} cards of the same district from hand`;
  }
  return "Needs a card in your support pile for that district";
}

export function constructBlockReason(state: GameState, player: PlayerId): string | null {
  const match = DISTRICTS.some((district) => {
    if (handCardsInDistrict(state, player, district).length < CONSTRUCT_COST) return false;
    return state.availableMonuments.some(
      (entry) => printedDistrict(entry.cardId) === district,
    );
  });
  if (match) return null;
  if (!sameDistrictCount(state, player, CONSTRUCT_COST)) {
    return `Discard ${CONSTRUCT_COST} cards of the same district from hand`;
  }
  return "Need an available monument of that district";
}
