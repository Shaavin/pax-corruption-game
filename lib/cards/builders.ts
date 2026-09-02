import { EffectId } from "./effects.ts";
import {
  CardKind,
  EffectType,
  type AllianceCard,
  type CivilCard,
  type ConspiracyCard,
  type DistrictId,
  type Effect,
  type ElectionCard,
} from "./schema.ts";

export function civil(
  id: string,
  name: string,
  district: DistrictId,
  influence: number,
): CivilCard {
  return {
    id,
    kind: CardKind.Civil,
    name,
    district,
    influence,
    art: `/cards/deck/${id}.png`,
  };
}

export function alliance(
  id: string,
  name: string,
  district: DistrictId,
  text: string,
  effects: Effect[],
  allianceSymbols = 1,
): AllianceCard {
  return {
    id,
    kind: CardKind.Alliance,
    name,
    district,
    allianceSymbols,
    policySupportValue: 2,
    text,
    effects,
    art: `/cards/deck/${id}.png`,
  };
}

export function conspiracy(
  id: string,
  name: string,
  district: DistrictId,
): ConspiracyCard {
  const label = district.charAt(0).toUpperCase() + district.slice(1);
  return {
    id,
    kind: CardKind.Conspiracy,
    name,
    district,
    text: `Remove and discard ALL cards in ${label}, then discard this conspiracy.`,
    effects: [
      {
        type: EffectType.Triggered,
        id: EffectId.DistrictWipe,
        params: { district },
      },
    ],
    art: `/cards/deck/${id}.png`,
  };
}

export function election(n: 1 | 2 | 3 | 4): ElectionCard {
  return {
    id: `election-${n}`,
    kind: CardKind.Election,
    name: "General Election",
    art: `/cards/deck/election-${n}.svg`,
  };
}
