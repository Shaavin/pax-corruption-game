import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG, MAIN_DECK, partyStartingMatches } from "./catalog.ts";
import { EFFECT_IDS } from "./effects.ts";
import { CardKind, DISTRICTS } from "./schema.ts";
import { EXECUTIVE, MONUMENTS, PARTIES, POLICIES } from "./setup-cards.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const errors: string[] = [];

function fail(message: string) {
  errors.push(message);
}

const ids = CATALOG.map((card) => card.id);
if (new Set(ids).size !== ids.length) {
  fail("Duplicate catalog ids");
}

const kindCount = (kind: (typeof CardKind)[keyof typeof CardKind]) =>
  MAIN_DECK.filter((card) => card.kind === kind).length;

if (kindCount(CardKind.Civil) !== 72) {
  fail(`Expected 72 civil, got ${kindCount(CardKind.Civil)}`);
}
if (kindCount(CardKind.Alliance) !== 24) {
  fail(`Expected 24 alliance, got ${kindCount(CardKind.Alliance)}`);
}
if (kindCount(CardKind.Conspiracy) !== 8) {
  fail(`Expected 8 conspiracy, got ${kindCount(CardKind.Conspiracy)}`);
}
if (kindCount(CardKind.Election) !== 4) {
  fail(`Expected 4 election, got ${kindCount(CardKind.Election)}`);
}
if (MAIN_DECK.length !== 108) fail(`Expected 108 main-deck cards, got ${MAIN_DECK.length}`);
if (PARTIES.length !== 8) fail(`Expected 8 parties, got ${PARTIES.length}`);
if (MONUMENTS.length !== 8) fail(`Expected 8 monuments, got ${MONUMENTS.length}`);
if (POLICIES.length !== 8) fail(`Expected 8 policies, got ${POLICIES.length}`);
if (EXECUTIVE.length !== 2) fail(`Expected 2 executive faces, got ${EXECUTIVE.length}`);

for (const district of DISTRICTS) {
  const civil = MAIN_DECK.filter(
    (card) => card.kind === CardKind.Civil && card.district === district,
  );
  const alliance = MAIN_DECK.filter(
    (card) => card.kind === CardKind.Alliance && card.district === district,
  );
  const conspiracy = MAIN_DECK.filter(
    (card) => card.kind === CardKind.Conspiracy && card.district === district,
  );
  if (civil.length !== 18) fail(`${district} civil count ${civil.length}`);
  if (alliance.length !== 6) fail(`${district} alliance count ${alliance.length}`);
  if (conspiracy.length !== 2) fail(`${district} conspiracy count ${conspiracy.length}`);
}

const knownEffects = new Set<string>(EFFECT_IDS);
for (const card of CATALOG) {
  if (!("effects" in card)) continue;
  for (const effect of card.effects) {
    if (!knownEffects.has(effect.id)) {
      fail(`${card.id} uses unknown effect ${effect.id}`);
    }
  }
}

for (const card of CATALOG) {
  const file = path.join(root, "public", card.art.replace(/^\//, ""));
  if (!existsSync(file)) fail(`Missing art for ${card.id}: ${card.art}`);
}

for (const party of PARTIES) {
  if (!MONUMENTS.some((monument) => monument.id === party.guaranteedMonumentId)) {
    fail(`${party.name} guaranteed monument missing: ${party.guaranteedMonumentId}`);
  }
  const matches = partyStartingMatches(party);
  party.startingCards.forEach((ref, index) => {
    if (matches[index].length === 0) {
      fail(
        `${party.name} starting card not found: ${ref.name} (${ref.district})`,
      );
    }
  });
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log(
  `Catalog ok: ${MAIN_DECK.length} main-deck, ${PARTIES.length} parties, ${MONUMENTS.length} monuments, ${POLICIES.length} policies.`,
);
