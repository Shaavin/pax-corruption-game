import { getCard } from "../cards/catalog.ts";
import { CardKind, DISTRICTS, type DistrictId } from "../cards/schema.ts";
import type { CardInstance, GameState, PlayerId } from "./types.ts";

export const DEFAULT_ALLIANCE_LIMIT = 1;
export const REFERENDUM_SUPPORTER_MIN = 3;
export const RECRUIT_COST = 3;
export const CONSTRUCT_COST = 5;
export const REFERENDUM_COST = 2;
export const FLAG_CAMPAIGNED = "campaigned";

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

export function policySupportValue(cardId: string): number {
  const def = getCard(cardId);
  return def.kind === CardKind.Alliance ? 2 : 1;
}

export function allianceCount(state: GameState, player: PlayerId, district: DistrictId): number {
  return state.players[player].tableau[district].filter(
    (card) => getCard(card.cardId).kind === CardKind.Alliance,
  ).length;
}

export function allianceLimit(): number {
  return DEFAULT_ALLIANCE_LIMIT;
}

export function canPlayAlliance(
  state: GameState,
  player: PlayerId,
  district: DistrictId,
): boolean {
  return allianceCount(state, player, district) < allianceLimit();
}

export function handCardsInDistrict(
  state: GameState,
  player: PlayerId,
  district: DistrictId,
): CardInstance[] {
  return state.players[player].hand.filter((card) => {
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

export function takeSpend(
  hand: CardInstance[],
  instanceIds: readonly string[],
  count: number,
): { cards: CardInstance[]; district: DistrictId } {
  if (instanceIds.length !== count) {
    throw new Error(`Expected ${count} cards, got ${instanceIds.length}`);
  }
  if (new Set(instanceIds).size !== instanceIds.length) {
    throw new Error("Spend cards must be unique");
  }
  const cards = instanceIds.map((id) => {
    const index = hand.findIndex((card) => card.instanceId === id);
    if (index < 0) {
      throw new Error(`Card ${id} is not in hand`);
    }
    return hand[index]!;
  });
  const districts = cards.map((card) => printedDistrict(card.cardId));
  const district = districts[0];
  if (!district || districts.some((entry) => entry !== district)) {
    throw new Error("Spend cards must share a printed district");
  }
  for (const id of instanceIds) {
    const index = hand.findIndex((card) => card.instanceId === id);
    hand.splice(index, 1);
  }
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

export function recruitBlockReason(state: GameState, player: PlayerId): string | null {
  if (!sameDistrictCount(state, player, RECRUIT_COST)) {
    return `Discard ${RECRUIT_COST} cards of the same district from hand`;
  }
  return null;
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

export function referendumBlockReason(state: GameState, player: PlayerId): string | null {
  const tucked = state.players[player].policySupporters.length;
  if (tucked < REFERENDUM_SUPPORTER_MIN) {
    return `Need ${REFERENDUM_SUPPORTER_MIN}+ of your own policy supporters (you have ${tucked})`;
  }
  if (!sameDistrictCount(state, player, REFERENDUM_COST)) {
    return `Discard ${REFERENDUM_COST} cards of the same district from hand`;
  }
  return null;
}
