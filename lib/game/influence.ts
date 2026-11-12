import { getCard } from "../cards/catalog.ts";
import { CardKind, District, type DistrictId } from "../cards/schema.ts";
import type { GameState, PlayerId } from "./types.ts";

export type DistrictInfluence = {
  civil: number;
  support: number;
  /** Planet Next bank (Horsard only). */
  bank: number;
  total: number;
};

/**
 * Civil printed values in this district's tableau, plus 1 per support-pile card,
 * plus 1 per Planet Next banked card (Horsard only). Policy and alliance
 * modifiers arrive with Phase 6 abilities.
 */
export function districtInfluence(
  tableau: readonly { cardId: string }[],
  supportCount: number,
  bankCount = 0,
): DistrictInfluence {
  let civil = 0;
  for (const entry of tableau) {
    const card = getCard(entry.cardId);
    if (card.kind === CardKind.Civil) {
      civil += card.influence;
    }
  }
  return {
    civil,
    support: supportCount,
    bank: bankCount,
    total: civil + supportCount + bankCount,
  };
}

export function playerDistrictInfluence(
  state: GameState,
  player: PlayerId,
  district: DistrictId,
): DistrictInfluence {
  const seat = state.players[player];
  return districtInfluence(
    seat.tableau[district],
    seat.support[district].length,
    district === District.Horsard ? seat.planetNextBank.length : 0,
  );
}
