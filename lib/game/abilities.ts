/**
 * Card abilities that change rules continuously (Phase 6, part 1): who is
 * silenced, which effects are live, and the limits they change. Triggered and
 * free-action abilities build on these helpers.
 */
import { getCard } from "../cards/catalog.ts";
import { EffectId } from "../cards/effects.ts";
import {
  CardKind,
  District,
  MonumentId,
  PolicyId,
  type DistrictId,
  type PolicyIdValue,
} from "../cards/schema.ts";
import type { CardInstance, GameState, PlayerId } from "./types.ts";
import { otherPlayer } from "./zones.ts";

export const BASE_HAND_LIMIT = 5;
export const DEFAULT_ALLIANCE_LIMIT = 1;

export type AllianceInPlay = {
  card: CardInstance;
  owner: PlayerId;
  /** The lane it sits in (Century Inc. can move an alliance off its printed district). */
  occupied: DistrictId;
  /** The district its text names. */
  printed: DistrictId;
  effectIds: string[];
};

function allianceEntry(owner: PlayerId, card: CardInstance, occupied: DistrictId): AllianceInPlay | null {
  const def = getCard(card.cardId);
  if (def.kind !== CardKind.Alliance) return null;
  return {
    card,
    owner,
    occupied,
    printed: def.district,
    effectIds: def.effects.map((effect) => effect.id),
  };
}

/** Every alliance on the table, both players. */
export function alliancesInPlay(state: GameState): AllianceInPlay[] {
  const result: AllianceInPlay[] = [];
  for (const owner of [0, 1] as const) {
    for (const district of state.districtOrder) {
      for (const card of state.players[owner].tableau[district]) {
        const entry = allianceEntry(owner, card, district);
        if (entry) result.push(entry);
      }
    }
  }
  return result;
}

/**
 * District Governor silences the **opponent's** alliances in the district it
 * names. Two opposing Governors of the same district silence each other (FAQ).
 * Financial Bankers can't be silenced.
 */
export function isSilenced(state: GameState, alliance: AllianceInPlay): boolean {
  if (alliance.effectIds.includes(EffectId.CountsAsTwoAlliances)) return false;
  return alliancesInPlay(state).some(
    (other) =>
      other.owner === otherPlayer(alliance.owner) &&
      other.effectIds.includes(EffectId.DistrictGovernor) &&
      other.printed === alliance.occupied,
  );
}

/** Alliances whose abilities are live (not silenced). */
export function activeAlliances(state: GameState): AllianceInPlay[] {
  return alliancesInPlay(state).filter((alliance) => !isSilenced(state, alliance));
}

/**
 * Does `player` have a live alliance with this effect? Pass `printed` to match
 * the district the card's text names (e.g. Order of Knights of Horsard).
 */
export function hasActiveAlliance(
  state: GameState,
  player: PlayerId,
  effectId: string,
  printed?: DistrictId,
): boolean {
  return activeAlliances(state).some(
    (alliance) =>
      alliance.owner === player &&
      alliance.effectIds.includes(effectId) &&
      (printed === undefined || alliance.printed === printed),
  );
}

export function ownsMonument(state: GameState, player: PlayerId, monumentId: string): boolean {
  return state.players[player].monuments.some((card) => card.cardId === monumentId);
}

export function policyActive(state: GameState, policyId: PolicyIdValue): boolean {
  const def = getCard(policyId);
  return def.kind === CardKind.Policy && state.policy[def.district] === policyId;
}

/** Hand limit: 5, +2 with Dragon Gate. */
export function handLimit(state: GameState, player: PlayerId): number {
  return BASE_HAND_LIMIT + (ownsMonument(state, player, MonumentId.DragonGate) ? 2 : 0);
}

/** Alliances a player may hold in one lane: 1, 2 with Model Society, −1 in Shavvinne under Martial Law. */
export function allianceLimit(state: GameState, player: PlayerId, district: DistrictId): number {
  let limit = ownsMonument(state, player, MonumentId.ModelSociety) ? 2 : DEFAULT_ALLIANCE_LIMIT;
  if (district === District.Shavvinne && policyActive(state, PolicyId.ShavvinneA)) limit -= 1;
  return Math.max(0, limit);
}

/** Martial Law: no action may discard 2+ Shavvinne cards. */
export function martialLawBlocks(state: GameState, printedDistricts: readonly DistrictId[]): boolean {
  if (!policyActive(state, PolicyId.ShavvinneA)) return false;
  return printedDistricts.filter((district) => district === District.Shavvinne).length >= 2;
}

/** Order of Knights: "Conspiracy cannot be played in <district>" (either player). */
export function conspiracyBlocked(state: GameState, district: DistrictId): boolean {
  return activeAlliances(state).some(
    (alliance) =>
      alliance.effectIds.includes(EffectId.CivilPlusOneBlockConspiracy) && alliance.printed === district,
  );
}

/** Market Regulation: civil cards of 8 or higher can't be played in Horsard. */
export function marketRegulationBlocks(state: GameState, cardId: string): boolean {
  const def = getCard(cardId);
  return (
    policyActive(state, PolicyId.HorsardB) &&
    def.kind === CardKind.Civil &&
    def.district === District.Horsard &&
    def.influence >= 8
  );
}

/**
 * A district's policy is frozen against proposals while a live District
 * Governor names it (two opposing Governors silence each other, so it thaws).
 */
export function policyFrozen(state: GameState, district: DistrictId): boolean {
  return activeAlliances(state).some(
    (alliance) => alliance.effectIds.includes(EffectId.DistrictGovernor) && alliance.printed === district,
  );
}

/** United Front: a discard landing in Smarbbit goes to the non-discarding player's pile. */
export function unitedFrontRedirect(state: GameState, landing: DistrictId): boolean {
  return landing === District.Smarbbit && policyActive(state, PolicyId.SmarbbitA);
}
