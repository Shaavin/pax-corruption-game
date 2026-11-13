import { MAIN_DECK } from "./deck.ts";
import { EVENTS } from "./expansion.ts";
import { DECREES, MONUMENTS, PARTIES, POLICIES } from "./setup-cards.ts";
import {
  CardKind,
  type CatalogCard,
  type DistrictId,
  type MainDeckCard,
  type MonumentCard,
  type MonumentIdValue,
  type PartyCard,
  type PartyIdValue,
} from "./schema.ts";

/**
 * Expansion events under their event id. A regular event is catalogued as its
 * **civil side** (civil name, value, district), because that is how it behaves
 * once on the table; `getEvent` has the event side. Legacy events have no civil side.
 */
const EVENT_CATALOG: CatalogCard[] = EVENTS.map((event) =>
  event.legacy
    ? { id: event.id, kind: CardKind.Event, name: event.name, art: event.art }
    : {
        id: event.id,
        kind: CardKind.Civil,
        name: event.civilName,
        art: event.art,
        district: event.district,
        influence: event.influence,
      },
);

export const CATALOG: CatalogCard[] = [
  ...MAIN_DECK,
  ...PARTIES,
  ...MONUMENTS,
  ...POLICIES,
  ...DECREES,
  ...EVENT_CATALOG,
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

export function getParty(id: PartyIdValue): PartyCard {
  const card = getCard(id);
  if (card.kind !== CardKind.Party) {
    throw new Error(`${id} is not a party`);
  }
  return card;
}

export function partyRelatedCards(party: PartyCard): {
  starting: MainDeckCard[];
  monument: MonumentCard;
} {
  const starting = party.startingCards.map((ref) => {
    const matches = findDeckCards(ref);
    if (matches.length === 0) {
      throw new Error(
        `Cannot resolve ${party.name} starting card ${ref.name} (${ref.district})`,
      );
    }
    return matches[0]!;
  });
  return {
    starting,
    monument: monumentById(party.guaranteedMonumentId),
  };
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

export { MAIN_DECK, PARTIES, MONUMENTS, POLICIES, DECREES };
