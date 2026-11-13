import { getCard } from "../cards/catalog.ts";
import { EffectId } from "../cards/effects.ts";
import { CardKind, District, PolicyId, type DistrictId } from "../cards/schema.ts";
import { hasActiveAlliance, policyActive } from "./abilities.ts";
import type { GameState, PlayerId } from "./types.ts";
import { influenceIsSupport, supportCount } from "./world.ts";

export type DistrictInfluence = {
  /** Printed civil values (Secularism doubles small Shavvinne civils). */
  civil: number;
  /** Support-pile cards (Populist Forum makes Dragonara ones worth 2). */
  support: number;
  /** Planet Next bank (Horsard only). */
  bank: number;
  /** Order of Knights +1s and Economic Reform +3s. */
  bonus: number;
  total: number;
};

/**
 * Plain influence: civil printed values, plus 1 per support-pile card, plus
 * banked cards. Used where no game state is at hand; prefer
 * `playerDistrictInfluence`, which applies card abilities.
 */
export function districtInfluence(
  tableau: readonly { cardId: string }[],
  supportCount: number,
  bankCount = 0,
): DistrictInfluence {
  let civil = 0;
  for (const entry of tableau) {
    const card = getCard(entry.cardId);
    if (card.kind === CardKind.Civil) civil += card.influence;
  }
  return { civil, support: supportCount, bank: bankCount, bonus: 0, total: civil + supportCount + bankCount };
}

/** Influence with every live ability applied. */
export function playerDistrictInfluence(
  state: GameState,
  player: PlayerId,
  district: DistrictId,
): DistrictInfluence {
  const seat = state.players[player];
  const tableau = seat.tableau[district];
  const secularism = district === District.Shavvinne && policyActive(state, PolicyId.ShavvinneB);
  const knights = hasActiveAlliance(state, player, EffectId.CivilPlusOneBlockConspiracy, district);

  let civil = 0;
  let bonus = 0;
  let played = 0;
  for (const entry of tableau) {
    const card = getCard(entry.cardId);
    if (card.kind === CardKind.Alliance) played += 1;
    if (card.kind !== CardKind.Civil) continue;
    played += 1;
    civil += secularism && card.influence <= 5 ? card.influence * 2 : card.influence;
    // Order of Knights: "Each of your <district> civil cards now gives you +1 influence."
    if (knights && card.district === district) bonus += 1;
  }
  // Economic Reform: "Each played card in Horsard, even alliance, gains +3 influence."
  if (district === District.Horsard && policyActive(state, PolicyId.HorsardA)) bonus += 3 * played;

  const perDiscard = district === District.Dragonara && policyActive(state, PolicyId.DragonaraB) ? 2 : 1;
  const support = supportCount(state, player, district) * perDiscard;
  // South (expansion): "Influence in <district> is now reduced to player's support."
  if (influenceIsSupport(state, district)) return { civil: 0, support, bank: 0, bonus: 0, total: support };
  const bank = district === District.Horsard ? seat.planetNextBank.length : 0;
  return { civil, support, bank, bonus, total: civil + support + bank + bonus };
}
