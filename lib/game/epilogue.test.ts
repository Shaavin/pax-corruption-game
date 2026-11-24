/** The victory passage names this game's winner and what won it (Joe's text, 2026-11-22). */
import { WorldPower } from "../cards/expansion.ts";
import { DecreeId, MonumentId, PartyId, type DistrictId } from "../cards/schema.ts";
import { currentActor, legalActions } from "./engine.ts";
import { victoryPassage } from "./epilogue.ts";
import { newReplay, stepReplay } from "./record.ts";
import { assert, report, takeFromDeck } from "./test-helpers.ts";
import { VictoryKind, type GameState, type PlayerId } from "./types.ts";
import { declarableVictories } from "./victory.ts";

/** An expansion game just past setup, with player 1 (seat 0) leading the Trinity Party. */
function game(): GameState {
  let replay = newReplay(11, { expansion: true, foreignInfluence: false });
  while (replay.state.phase === "setup") replay = stepReplay(replay, legalActions(replay.state, currentActor(replay.state))[0]!);
  const state = structuredClone(replay.state);
  state.players[0].partyId = PartyId.Trinity;
  state.players[1].partyId = PartyId.Conservative;
  for (const seat of state.players) for (const district of state.districtOrder) seat.support[district] = [];
  return state;
}

function giveSupport(state: GameState, player: PlayerId, district: DistrictId, count: number): void {
  state.players[player].support[district].push(...takeFromDeck(state, () => true, count));
}

function expect(actual: string, expected: string, label: string): void {
  assert(actual === expected, `${label}:\n  got:  ${actual}\n  want: ${expected}`);
}

// Civil: the party alone.
{
  const state = game();
  expect(
    victoryPassage(state, { kind: VictoryKind.Civil, player: 0 }),
    "With a Civil Victory, the Trinity Party is elected into the Federal Union of Democracy. Both sides of the Vitalic Union have now realized that the only way forward is through cooperation and joint leadership.",
    "Civil",
  );
  assert(victoryPassage(state, { kind: VictoryKind.Civil, player: 1 }).includes("the Conservative Party is elected"), "Civil names the winner's party");
}

// Political: the two decrees met (Imperium by partisans, Profectus by support), not the active one they missed.
{
  const state = game();
  state.decrees = [
    { id: DecreeId.Imperium, active: true },
    { id: DecreeId.Profectus, active: true },
    { id: DecreeId.Academia, active: true },
    { id: DecreeId.DeJures, active: false },
  ];
  state.players[0].partisans = 2;
  state.players[1].partisans = 0;
  giveSupport(state, 0, state.districtOrder[0]!, 5);
  assert(
    declarableVictories(state, 0).some((victory) => victory.kind === VictoryKind.Political),
    "The position is a Political Victory",
  );
  expect(
    victoryPassage(state, { kind: VictoryKind.Political, player: 0 }),
    "With a Political Victory, the Trinity Party issues the Imperial Edict of Autocracy. The opposition is now marginalized, with little to no chance of being elected to power in the period of Pax Imperium and Profectus.",
    "Political",
  );
}

// Cultural: the last two monuments the winner built, in the order built.
{
  const state = game();
  state.players[0].monuments = [MonumentId.IntelNetwork, MonumentId.RomanBasilica, MonumentId.ModelSociety].map((cardId) => ({
    instanceId: cardId,
    cardId,
    faceUp: true,
  }));
  expect(
    victoryPassage(state, { kind: VictoryKind.Cultural, player: 0 }),
    "With a Cultural Victory, the Trinity Party guides the Union into the Era of Vitalic Renaissance. Roman Basilica and Model Society have inspired and empowered the citizens to create transcending arts & innovations.",
    "Cultural",
  );
}

// Diplomatic: every World Power the winner has the higher relation with.
{
  const state = game();
  const relations = state.expansion!.relations;
  relations[0] = { [WorldPower.North]: 3, [WorldPower.South]: 1, [WorldPower.East]: 2, [WorldPower.West]: 4 };
  relations[1] = { [WorldPower.North]: 1, [WorldPower.South]: 2, [WorldPower.East]: 0, [WorldPower.West]: 1 };
  expect(
    victoryPassage(state, { kind: VictoryKind.Diplomatic, player: 0 }),
    "With a Diplomatic Victory, the Trinity Party negotiates to become the Founder of the World Union. Close relations with the West, North, and East bring in a large influx of talents that help shape a peaceful future.",
    "Diplomatic",
  );
  relations[0][WorldPower.South] = 5;
  assert(
    victoryPassage(state, { kind: VictoryKind.Diplomatic, player: 0 }).includes("with the West, North, East, and South bring"),
    "Diplomatic lists all four powers",
  );
}

// Military: as many warlords as partisans led by.
{
  const state = game();
  state.players[0].partisans = 5;
  state.players[1].partisans = 2;
  expect(
    victoryPassage(state, { kind: VictoryKind.Military, player: 0 }),
    "With a Military Victory, the Trinity Party finally wins the Crown of the Vida Vesta. Choirs are sung as the three ambitious partner warlords welcome the party's leaders into power while secretly plotting their downfall.",
    "Military",
  );
  state.players[0].partisans = 6;
  assert(victoryPassage(state, { kind: VictoryKind.Military, player: 0 }).includes("the four ambitious"), "Military counts the lead");
}

// Popularity: every district led by 9 or more support.
{
  const state = game();
  giveSupport(state, 0, "smarbbit", 9);
  expect(
    victoryPassage(state, { kind: VictoryKind.Popularity, player: 0, district: "smarbbit" }),
    "With a Popularity Victory, the Trinity Party breaks the Union into small Republics of Eastern Vitali. Opinion polarization has brought out the most radical in Smarbbit, who see independence as the only way forward.",
    "Popularity",
  );
  giveSupport(state, 0, "horsard", 10);
  giveSupport(state, 1, "horsard", 1);
  giveSupport(state, 0, "dragonara", 9);
  giveSupport(state, 1, "dragonara", 1);
  const named = state.districtOrder.filter((district) => district !== "dragonara" && district !== "shavvinne");
  const want = named.map((district) => district[0]!.toUpperCase() + district.slice(1)).join(" and ");
  assert(
    victoryPassage(state, { kind: VictoryKind.Popularity, player: 0, district: "smarbbit" }).includes(`radical in ${want}, who`),
    `Popularity names both districts led by 9+ (${want}), not one led by 8`,
  );
}

// Ideological: the winning ideology.
{
  const state = game();
  expect(
    victoryPassage(state, { kind: VictoryKind.Ideological, player: 0, symbol: "atom" }),
    "With an Ideological Victory, the Trinity Party forms the Police State of Brotherhood. Heretics to the dominant ideology of scientific endeavor are subsequently controlled or exiled by the state-run brotherhood watch.",
    "Ideological",
  );
  for (const [symbol, words] of [["crown", "authoritative order"], ["chart", "economic growth"], ["scales", "judicial equality"]] as const) {
    assert(victoryPassage(state, { kind: VictoryKind.Ideological, player: 0, symbol }).includes(`ideology of ${words} are`), `Ideological: ${symbol}`);
  }
}

report("Epilogue ok: each victory's passage names the winner's party and what won it");
