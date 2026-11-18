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

/**
 * Faces changed after first ingest get a new file name (`-v2`), so offline caches never
 * serve a stale face (see app/sw.js). 2026-11-18: Divine Inquisitors' new text.
 */
const REVISED_DECK_ART = new Set(["shavvinne-a-6"]);

function deckArt(id: string): string {
  return `/cards/deck/${id}${REVISED_DECK_ART.has(id) ? "-v2" : ""}.png`;
}

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
    art: deckArt(id),
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
    senateVotes: 2,
    text,
    effects,
    art: deckArt(id),
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
    art: deckArt(id),
  };
}

export function election(n: 1 | 2 | 3 | 4): ElectionCard {
  return {
    id: `election-${n}`,
    kind: CardKind.Election,
    name: "General Election",
    art: "/cards/deck/election.png",
  };
}
