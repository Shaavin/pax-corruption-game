import { MAIN_DECK } from "./deck";
import { EXECUTIVE, MONUMENTS, PARTIES, POLICIES } from "./setup-cards";
import {
  CardKind,
  type CatalogCard,
  type DistrictId,
  type MainDeckCard,
  type MonumentCard,
  type MonumentIdValue,
  type PartyCard,
} from "./schema";

export const CATALOG: CatalogCard[] = [
  ...MAIN_DECK,
  ...PARTIES,
  ...MONUMENTS,
  ...POLICIES,
  ...EXECUTIVE,
];

const byId = new Map(CATALOG.map((card) => [card.id, card]));

export function getCard(id: string): CatalogCard {
  const card = byId.get(id);
  if (!card) {
    throw new Error(`Unknown card id: ${id}`);
  }
  return card;
}

export function normalizeCardName(name: string): string {
  return name.replace(/['’]/g, "'").trim().toLowerCase();
}

export function findDeckCards(opts: {
  name: string;
  district?: DistrictId;
}): MainDeckCard[] {
  const name = normalizeCardName(opts.name);
  return MAIN_DECK.filter((card) => {
    if (normalizeCardName(card.name) !== name) return false;
    if (opts.district && card.kind !== CardKind.Election && card.district !== opts.district) {
      return false;
    }
    return true;
  });
}

export function partyStartingMatches(party: PartyCard): MainDeckCard[][] {
  return party.startingCards.map((ref) => findDeckCards(ref));
}

export function monumentById(id: MonumentIdValue): MonumentCard {
  const card = getCard(id);
  if (card.kind !== CardKind.Monument) {
    throw new Error(`${id} is not a monument`);
  }
  return card;
}

export function mainDeckWithoutElections(): MainDeckCard[] {
  return MAIN_DECK.filter((card) => card.kind !== CardKind.Election);
}

export { MAIN_DECK, PARTIES, MONUMENTS, POLICIES, EXECUTIVE };
