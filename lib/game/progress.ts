import { MonumentId, SYMBOLS, type DistrictId, type SymbolId } from "../cards/schema.ts";
import { ownsMonument } from "./abilities.ts";
import { activeDecrees, satisfiedDecrees } from "./decrees.ts";
import { GENERAL_ELECTION_COUNT, tallyElection } from "./election.ts";
import { VictoryKind, type GameState, type PlayerId, type VictoryKindId } from "./types.ts";
import {
  CULTURAL_LEAD,
  DIPLOMATIC_POWERS,
  IDEOLOGICAL_COUNT,
  militaryLead,
  POLITICAL_DECREES,
  POPULARITY_LEAD,
  privateSymbols,
  ROMAN_BASILICA_WINS,
  totalSymbols,
} from "./victory.ts";
import { relationLeads, supportCount, victoryActive } from "./world.ts";
import { otherPlayer } from "./zones.ts";

/**
 * How close one player is to one victory, for the UI's victory race. Built from the
 * same checks as `declarableVictories`, so `met` agrees with what can be declared
 * (Popularity, Military, Ideological, Cultural, Diplomatic, Political).
 */
export type VictoryStanding = {
  /** Progress toward the goal; may be negative for leads ("2 behind"). */
  value: number;
  /** What `value` must reach. */
  target: number;
  met: boolean;
  /** Where the best attempt is: Popularity's district, Ideological's symbol. */
  district?: DistrictId;
  symbol?: SymbolId;
};

export type VictoryRaceRow = {
  kind: VictoryKindId;
  /** Expansion: off until a legacy event activates it. */
  active: boolean;
  standing: Record<PlayerId, VictoryStanding>;
};

export type VictoryRace = {
  rows: VictoryRaceRow[];
  civil: {
    /** General Elections still in the deck. */
    electionsLeft: number;
    /** Who would win the election if it were scored now (null: setup). */
    projected: PlayerId | null;
    /** Roman Basilica owner's election wins toward declaring Civil Victory early. */
    basilica: { player: PlayerId; wins: number; target: number } | null;
  };
};

function standing(value: number, target: number, extra: Partial<VictoryStanding> = {}): VictoryStanding {
  return { value, target, met: value >= target, ...extra };
}

function popularity(state: GameState, player: PlayerId): VictoryStanding {
  const opponent = otherPlayer(player);
  let best: { district: DistrictId; lead: number } | null = null;
  for (const district of state.districtOrder) {
    const lead = supportCount(state, player, district) - supportCount(state, opponent, district);
    if (!best || lead > best.lead) best = { district, lead };
  }
  return standing(best?.lead ?? 0, POPULARITY_LEAD, best ? { district: best.district } : {});
}

/**
 * Ideological: a symbol counts only if this player has more private copies of it than
 * the opponent; it needs 4+ total copies and strictly more than every other symbol.
 * Reports the closest such symbol (most total copies).
 */
function ideological(state: GameState, player: PlayerId): VictoryStanding {
  const mine = privateSymbols(state, player);
  const theirs = privateSymbols(state, otherPlayer(player));
  const totals = totalSymbols(state);
  let best: VictoryStanding | null = null;
  for (const symbol of SYMBOLS) {
    if (mine[symbol] <= theirs[symbol]) continue;
    const others = Math.max(...SYMBOLS.filter((other) => other !== symbol).map((other) => totals[other]));
    const target = Math.max(IDEOLOGICAL_COUNT, others + 1);
    const candidate = standing(totals[symbol], target, { symbol });
    if (!best || candidate.target - candidate.value < best.target - best.value) best = candidate;
  }
  return best ?? standing(0, IDEOLOGICAL_COUNT);
}

/** Every victory's standing for both players, plus the Civil (election) outlook. */
export function victoryRace(state: GameState): VictoryRace {
  const both = (compute: (player: PlayerId) => VictoryStanding): Record<PlayerId, VictoryStanding> => ({
    0: compute(0),
    1: compute(1),
  });
  const lead = (player: PlayerId, pick: (seat: PlayerId) => number) => pick(player) - pick(otherPlayer(player));

  const rows: VictoryRaceRow[] = [
    {
      kind: VictoryKind.Political,
      active: victoryActive(state, VictoryKind.Political),
      standing: both((player) => standing(satisfiedDecrees(state, player).length, POLITICAL_DECREES)),
    },
    {
      kind: VictoryKind.Military,
      active: victoryActive(state, VictoryKind.Military),
      standing: both((player) => standing(lead(player, (seat) => state.players[seat].partisans), militaryLead(state))),
    },
    {
      kind: VictoryKind.Popularity,
      active: victoryActive(state, VictoryKind.Popularity),
      standing: both((player) => popularity(state, player)),
    },
    {
      kind: VictoryKind.Ideological,
      active: victoryActive(state, VictoryKind.Ideological),
      standing: both((player) => ideological(state, player)),
    },
  ];
  if (state.expansion) {
    rows.push(
      {
        kind: VictoryKind.Cultural,
        active: victoryActive(state, VictoryKind.Cultural),
        standing: both((player) => standing(lead(player, (seat) => state.players[seat].monuments.length), CULTURAL_LEAD)),
      },
      {
        kind: VictoryKind.Diplomatic,
        active: victoryActive(state, VictoryKind.Diplomatic),
        standing: both((player) => standing(relationLeads(state, player), DIPLOMATIC_POWERS)),
      },
    );
  }

  const basilicaOwner = ([0, 1] as const).find((player) => ownsMonument(state, player, MonumentId.RomanBasilica));
  return {
    rows,
    civil: {
      electionsLeft: Math.max(0, GENERAL_ELECTION_COUNT - state.electionsOut.length),
      projected: state.phase === "setup" || state.firstPlayer === null ? null : tallyElection(state).winner,
      basilica:
        basilicaOwner === undefined
          ? null
          : { player: basilicaOwner, wins: state.players[basilicaOwner].electionWins, target: ROMAN_BASILICA_WINS },
    },
  };
}

/** Political needs two active decrees to exist at all; fewer are active early on. */
export function activeDecreeCount(state: GameState): number {
  return activeDecrees(state).length;
}
