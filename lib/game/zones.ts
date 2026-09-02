import { DISTRICTS, type DistrictId } from "../cards/schema.ts";
import type { CardInstance, PlayerId, PlayerState } from "./types.ts";

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0;
}

export function emptyByDistrict<T>(make: () => T): Record<DistrictId, T> {
  return Object.fromEntries(DISTRICTS.map((district) => [district, make()])) as Record<
    DistrictId,
    T
  >;
}

export function createEmptyPlayer(): PlayerState {
  return {
    hand: [],
    tableau: emptyByDistrict(() => []),
    support: emptyByDistrict(() => []),
    policySupporters: [],
    consultativeOffice: [],
    partyId: null,
    monuments: [],
    partisans: 0,
    handLimit: 5,
    electionWins: 0,
    consecutiveWins: 0,
  };
}

export function instantiate(cardId: string, faceUp = false): CardInstance {
  return { instanceId: cardId, cardId, faceUp };
}

export function cloneState<T>(value: T): T {
  return structuredClone(value);
}

export function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const other = new Set(b);
  return a.every((id) => other.has(id));
}

export function takeInstance(
  cards: CardInstance[],
  instanceId: string,
): CardInstance {
  const index = cards.findIndex((card) => card.instanceId === instanceId);
  if (index < 0) {
    throw new Error(`Card ${instanceId} is not in this zone`);
  }
  return cards.splice(index, 1)[0]!;
}
