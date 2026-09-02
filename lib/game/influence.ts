import { getCard } from "../cards/catalog.ts";
import { CardKind } from "../cards/schema.ts";

export type DistrictInfluence = {
  civil: number;
  support: number;
  total: number;
};

/** Civil printed values in this district's tableau, plus 1 per support-pile card. */
export function districtInfluence(
  tableau: readonly { cardId: string }[],
  supportCount: number,
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
    total: civil + supportCount,
  };
}
