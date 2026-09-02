import { getCard } from "@/lib/cards/catalog";
import {
  District,
  ExecutiveSide,
  MonumentId,
  PartyId,
  PolicyId,
  type CatalogCard,
  type DistrictId,
  type ExecutiveSideId,
  type MonumentIdValue,
  type PartyIdValue,
  type PolicyIdValue,
} from "@/lib/cards/schema";

export type FixtureCard = {
  instanceId: string;
  cardId: string;
  faceUp: boolean;
};

export type PlayerLayout = {
  hand: FixtureCard[];
  tableau: Record<DistrictId, FixtureCard[]>;
  support: Record<DistrictId, number>;
  policySupporters: number;
  office: FixtureCard[];
  partyId: PartyIdValue;
  monuments: MonumentIdValue[];
  partisans: number;
  executive: ExecutiveSideId | null;
};

export type LayoutFixture = {
  districtOrder: DistrictId[];
  policies: Record<DistrictId, PolicyIdValue | null>;
  opponent: PlayerLayout;
  you: PlayerLayout;
  market: FixtureCard[];
  availableMonuments: FixtureCard[];
  monumentDeckCount: number;
  deckCount: number;
  electionsOut: number;
};

function card(cardId: string, faceUp = true): FixtureCard {
  return { instanceId: cardId, cardId, faceUp };
}

const emptyTableau = (): Record<DistrictId, FixtureCard[]> => ({
  [District.Dragonara]: [],
  [District.Horsard]: [],
  [District.Shavvinne]: [],
  [District.Smarbbit]: [],
});

export const LAYOUT_FIXTURE: LayoutFixture = {
  districtOrder: [
    District.Horsard,
    District.Dragonara,
    District.Smarbbit,
    District.Shavvinne,
  ],
  policies: {
    [District.Horsard]: PolicyId.HorsardA,
    [District.Dragonara]: null,
    [District.Smarbbit]: PolicyId.SmarbbitB,
    [District.Shavvinne]: null,
  },
  opponent: {
    hand: [
      card("horsard-b-11", false),
      card("horsard-b-16", false),
      card("smarbbit-b-17", false),
      card("dragonara-b-8", false),
      card("shavvinne-b-8", false),
    ],
    tableau: {
      ...emptyTableau(),
      [District.Horsard]: [
        card("horsard-a-4"),
        card("horsard-b-3"),
        card("horsard-b-5"),
        card("horsard-b-6"),
        card("horsard-b-4"),
      ],
      [District.Smarbbit]: [card("smarbbit-a-4")],
    },
    support: {
      [District.Horsard]: 1,
      [District.Dragonara]: 0,
      [District.Smarbbit]: 4,
      [District.Shavvinne]: 2,
    },
    partyId: PartyId.Progressive,
    monuments: [MonumentId.IntelNetwork],
    partisans: 1,
    policySupporters: 3,
    office: [],
    executive: null,
  },
  you: {
    hand: [
      card("shavvinne-a-1"),
      card("shavvinne-a-6"),
      card("shavvinne-b-1"),
      card("dragonara-b-6"),
      card("horsard-b-8"),
    ],
    tableau: {
      ...emptyTableau(),
      [District.Dragonara]: [
        card("dragonara-a-3"),
        card("dragonara-b-3"),
        card("dragonara-b-4"),
        card("dragonara-b-5"),
        card("dragonara-b-2"),
        card("dragonara-b-1"),
      ],
      [District.Shavvinne]: [card("shavvinne-a-2")],
    },
    support: {
      [District.Horsard]: 3,
      [District.Dragonara]: 0,
      [District.Smarbbit]: 1,
      [District.Shavvinne]: 2,
    },
    partyId: PartyId.Trinity,
    monuments: [MonumentId.RomanBasilica],
    partisans: 0,
    policySupporters: 2,
    office: [],
    executive: ExecutiveSide.EmergencyState,
  },
  market: [
    card("dragonara-b-10"),
    card("horsard-a-3"),
    card("smarbbit-b-9"),
    card("shavvinne-c-1"),
    card("horsard-b-7"),
  ],
  availableMonuments: [
    card(MonumentId.DragonGate),
    card(MonumentId.PlanetNext),
    card(MonumentId.SpaceAgency),
    card(MonumentId.SmartDoctrine),
  ],
  monumentDeckCount: 2,
  deckCount: 92,
  electionsOut: 0,
};

export function resolveCard(cardId: string): CatalogCard {
  return getCard(cardId);
}
