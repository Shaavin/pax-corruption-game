/**
 * The passage typed over the victory scene (components/game/VictoryStory.tsx): Joe's text for
 * each victory (2026-11-22, lightly edited with his OK), naming what this game's winner achieved:
 * their party, and the decrees, monuments, World Powers, partisans, districts, or ideology that won it.
 */
import { getCard, getParty } from "../cards/catalog.ts";
import { WorldPower, type WorldPowerId } from "../cards/expansion.ts";
import { DecreeId, type DecreeIdValue, type DistrictId, type SymbolId } from "../cards/schema.ts";
import { activeDecrees, satisfiedDecrees } from "./decrees.ts";
import { VictoryKind, type GameState, type Victory } from "./types.ts";
import { POPULARITY_LEAD } from "./victory.ts";
import { supportCount } from "./world.ts";
import { otherPlayer } from "./zones.ts";

const DECREE_NAME: Record<DecreeIdValue, string> = {
  [DecreeId.Imperium]: "Imperium",
  [DecreeId.Profectus]: "Profectus",
  [DecreeId.Academia]: "Academia",
  [DecreeId.DeJures]: "De Jures",
};
const DECREE_ORDER = Object.keys(DECREE_NAME) as DecreeIdValue[];

/** In the passage's order: "the West, North, and East". */
const POWER_ORDER: readonly WorldPowerId[] = [WorldPower.West, WorldPower.North, WorldPower.East, WorldPower.South];
const POWER_NAME: Record<WorldPowerId, string> = { west: "West", north: "North", east: "East", south: "South" };

const DISTRICT_NAME: Record<DistrictId, string> = {
  dragonara: "Dragonara",
  horsard: "Horsard",
  shavvinne: "Shavvinne",
  smarbbit: "Smarbbit",
};

const IDEOLOGY: Record<SymbolId, string> = {
  crown: "authoritative order",
  atom: "scientific endeavor",
  chart: "economic growth",
  scales: "judicial equality",
};

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** "A", "A and B", "A, B, and C". */
function listOf(items: readonly string[]): string {
  if (items.length <= 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

export function victoryPassage(state: GameState, victory: Victory): string {
  const player = victory.player;
  const opponent = otherPlayer(player);
  const seat = state.players[player];
  const party = seat.partyId ? `the ${getParty(seat.partyId).name}` : "the winning party";

  switch (victory.kind) {
    case VictoryKind.Civil:
      return `With a Civil Victory, ${party} is elected into the Federal Union of Democracy. Both sides of the Vitalic Union have now realized that the only way forward is through cooperation and joint leadership.`;

    case VictoryKind.Political: {
      // Two of the decrees they met (more than two: the first two in card order).
      const met = new Set(satisfiedDecrees(state, player));
      const active = new Set(activeDecrees(state));
      const names = [...DECREE_ORDER.filter((id) => met.has(id)), ...DECREE_ORDER.filter((id) => active.has(id) && !met.has(id))]
        .slice(0, 2)
        .map((id) => DECREE_NAME[id]);
      const pax = names.length ? `Pax ${listOf(names)}` : "Pax";
      return `With a Political Victory, ${party} issues the Imperial Edict of Autocracy. The opposition is now marginalized, with little to no chance of being elected to power in the period of ${pax}.`;
    }

    case VictoryKind.Cultural: {
      // The last two monuments they constructed, in the order they were built.
      const built = seat.monuments.slice(-2).map((monument) => getCard(monument.cardId).name);
      const inspired = built.length ? `${listOf(built)} ${built.length === 1 ? "has" : "have"}` : "Its monuments have";
      return `With a Cultural Victory, ${party} guides the Union into the Era of Vitalic Renaissance. ${inspired} inspired and empowered the citizens to create transcending arts & innovations.`;
    }

    case VictoryKind.Diplomatic: {
      const relations = state.expansion?.relations;
      const closer = relations ? POWER_ORDER.filter((power) => relations[player][power] > relations[opponent][power]) : [];
      const powers = closer.length ? `the ${listOf(closer.map((power) => POWER_NAME[power]))}` : "the World Powers";
      return `With a Diplomatic Victory, ${party} negotiates to become the Founder of the World Union. Close relations with ${powers} bring in a large influx of talents that help shape a peaceful future.`;
    }

    case VictoryKind.Military: {
      // As many warlords as partisans they lead by.
      const lead = seat.partisans - state.players[opponent].partisans;
      const warlords = lead >= 2 ? `the ${NUMBER_WORDS[lead] ?? lead} ambitious partner warlords` : "the ambitious partner warlords";
      return `With a Military Victory, ${party} finally wins the Crown of the Vida Vesta. Choirs are sung as ${warlords} welcome the party's leaders into power while secretly plotting their downfall.`;
    }

    case VictoryKind.Popularity: {
      // Every district they lead by 9 or more support.
      const leading = state.districtOrder.filter(
        (district) => supportCount(state, player, district) - supportCount(state, opponent, district) >= POPULARITY_LEAD,
      );
      if (!leading.length && victory.district) leading.push(victory.district);
      const where = leading.length ? listOf(leading.map((district) => DISTRICT_NAME[district])) : "the districts";
      return `With a Popularity Victory, ${party} breaks the Union into small Republics of Eastern Vitali. Opinion polarization has brought out the most radical in ${where}, who see independence as the only way forward.`;
    }

    case VictoryKind.Ideological: {
      const ideology = victory.symbol ? `the dominant ideology of ${IDEOLOGY[victory.symbol]}` : "the dominant ideology";
      return `With an Ideological Victory, ${party} forms the Police State of Brotherhood. Heretics to ${ideology} are subsequently controlled or exiled by the state-run brotherhood watch.`;
    }
  }
}
