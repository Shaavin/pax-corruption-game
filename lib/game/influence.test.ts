import { districtInfluence } from "./influence.ts";

const errors: string[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) errors.push(message);
}

{
  const empty = districtInfluence([], 0);
  assert(empty.civil === 0 && empty.support === 0 && empty.total === 0, "Empty district is 0");
}

{
  const supportOnly = districtInfluence([], 4);
  assert(supportOnly.civil === 0, "Support-only civil is 0");
  assert(supportOnly.support === 4 && supportOnly.total === 4, "Each support card is +1");
}

{
  const alliance = districtInfluence([{ cardId: "dragonara-a-3" }], 2);
  assert(alliance.civil === 0, "Alliances do not add district influence");
  assert(alliance.total === 2, "Alliance tableau still counts the support pile");
}

{
  // Technocrats 9, Time Committee 8, Robot Factories 7, Export Bureau 6, Grand Justices 8
  const youDragonara = districtInfluence(
    [
      { cardId: "dragonara-a-3" },
      { cardId: "dragonara-b-3" },
      { cardId: "dragonara-b-4" },
      { cardId: "dragonara-b-5" },
      { cardId: "dragonara-b-2" },
      { cardId: "dragonara-b-1" },
    ],
    0,
  );
  assert(youDragonara.civil === 38, `Dragonara civil ${youDragonara.civil}, want 9+8+7+6+8=38`);
  assert(youDragonara.total === 38, "No support: total equals civil");
}

{
  // Film Industry 8, Central Bank 7, Transportations 6, Estate Moguls 8 + 1 support
  const oppHorsard = districtInfluence(
    [
      { cardId: "horsard-a-4" },
      { cardId: "horsard-b-3" },
      { cardId: "horsard-b-5" },
      { cardId: "horsard-b-6" },
      { cardId: "horsard-b-4" },
    ],
    1,
  );
  assert(oppHorsard.civil === 29, `Horsard civil ${oppHorsard.civil}, want 8+7+6+8=29`);
  assert(oppHorsard.support === 1 && oppHorsard.total === 30, "Civil plus support pile");
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log("Influence ok: civil values plus support-pile count; alliances ignored.");
