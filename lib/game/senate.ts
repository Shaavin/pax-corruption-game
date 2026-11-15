import { getCard, POLICIES } from "../cards/catalog.ts";
import { CardKind, type DistrictId, type PolicyIdValue } from "../cards/schema.ts";
import { policyFrozen } from "./abilities.ts";
import { discardCards } from "./discard.ts";
import type { CardInstance, GameEvent, GameState, PlayerId } from "./types.ts";
import { senateAlwaysConvinced } from "./world.ts";

export const SENATE_SIZE = 5;

/** Civil and conspiracy Senators carry 1 vote, alliances 2. */
export function senatorVotes(cardId: string): number {
  const def = getCard(cardId);
  return def.kind === CardKind.Alliance ? def.senateVotes : 1;
}

export function senateTotalVotes(state: GameState): number {
  return state.senate.reduce((sum, card) => sum + senatorVotes(card.cardId), 0);
}

/** Votes needed to pass: more than half of the total. */
export function senateVotesNeeded(state: GameState): number {
  return Math.floor(senateTotalVotes(state) / 2) + 1;
}

/**
 * Does any revealed card convince this Senator?
 * - Civil: a revealed civil of the same district with a higher value.
 * - Alliance: a revealed alliance of the same district.
 * - Conspiracy: never.
 */
export function senatorConvinced(senatorCardId: string, revealedCardIds: readonly string[]): boolean {
  const senator = getCard(senatorCardId);
  if (senator.kind === CardKind.Civil) {
    return revealedCardIds.some((id) => {
      const card = getCard(id);
      return (
        card.kind === CardKind.Civil &&
        card.district === senator.district &&
        card.influence > senator.influence
      );
    });
  }
  if (senator.kind === CardKind.Alliance) {
    return revealedCardIds.some((id) => {
      const card = getCard(id);
      return card.kind === CardKind.Alliance && card.district === senator.district;
    });
  }
  return false;
}

/** Senate indexes (left → right) the revealed cards would convince. */
export function convincedSenators(state: GameState, revealedCardIds: readonly string[]): number[] {
  return state.senate.flatMap((card, index) =>
    senatorConvinced(card.cardId, revealedCardIds) || autoConvinced(state, card.cardId) ? [index] : [],
  );
}

/**
 * South "<district> cards in Senate are always convinced" (expansion): civil and alliance
 * Senators only. Conspiracy Senators are never convinced, South or not (Ian, 2026-11-15;
 * reverses the 2026-11-13 "conspiracies included" ruling).
 */
function autoConvinced(state: GameState, cardId: string): boolean {
  const def = getCard(cardId);
  if (def.kind === CardKind.Conspiracy) return false;
  return "district" in def && senateAlwaysConvinced(state, def.district);
}

export function convincedVotes(state: GameState, revealedCardIds: readonly string[]): number {
  return convincedSenators(state, revealedCardIds).reduce(
    (sum, index) => sum + senatorVotes(state.senate[index]!.cardId),
    0,
  );
}

export function revealPasses(state: GameState, revealedCardIds: readonly string[]): boolean {
  return convincedVotes(state, revealedCardIds) >= senateVotesNeeded(state);
}

/** Policy changes allowed in a district: neutral → either side, side → neutral. */
export function policyOptions(state: GameState, district: DistrictId): (PolicyIdValue | null)[] {
  if (state.policy[district] !== null) return [null];
  return POLICIES.filter((policy) => policy.district === district).map((policy) => policy.id);
}

/**
 * Districts whose policy a proposal with these revealed cards may change: the district of a
 * revealed card that itself convinces at least one Senator (Ian, 2026-11-14; replaces the
 * 2026-11-13 "any district" ruling). Cards that convince no one don't open their district.
 */
export function proposalDistricts(state: GameState, revealedCardIds: readonly string[]): Set<DistrictId> {
  const districts = new Set<DistrictId>();
  for (const id of revealedCardIds) {
    const def = getCard(id);
    if (!("district" in def) || districts.has(def.district)) continue;
    if (state.senate.some((senator) => senatorConvinced(senator.cardId, [id]))) districts.add(def.district);
  }
  return districts;
}

/** Every (district, policy) change a successful proposal with these revealed cards could make. */
export function policyTargets(
  state: GameState,
  revealedCardIds: readonly string[],
): { district: DistrictId; policyId: PolicyIdValue | null }[] {
  const open = proposalDistricts(state, revealedCardIds);
  return state.districtOrder
    .filter((district) => open.has(district) && !policyFrozen(state, district))
    .flatMap((district) =>
      policyOptions(state, district).map((policyId) => ({ district, policyId })),
    );
}

/** Influence Senate: rightmost Senator to the actor's support pile, new card seated leftmost. */
export function influenceSenate(
  state: GameState,
  player: PlayerId,
  card: CardInstance,
  events: GameEvent[],
): void {
  const removed = state.senate.pop();
  state.senate.unshift({ ...card, faceUp: true, occupiedDistrict: undefined });
  if (removed) {
    discardCards(state, player, [{ card: removed, owner: player }], events);
  }
  events.push({
    type: "senateInfluenced",
    player,
    seatedCardId: card.cardId,
    removedCardId: removed?.cardId ?? "",
  });
}
