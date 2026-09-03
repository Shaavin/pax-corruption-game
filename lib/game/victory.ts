import { getCard, getParty } from "../cards/catalog.ts";
import { CardKind, DISTRICTS, SYMBOLS, type SymbolId } from "../cards/schema.ts";
import { Phase, PLAYERS, VictoryKind, type GameEvent, type GameState, type PlayerId, type Victory } from "./types.ts";

export const MILITARY_LEAD = 3;
export const POPULARITY_LEAD = 9;
export const IDEOLOGICAL_COUNT = 4;

export function symbolCounts(state: GameState, player: PlayerId): Record<SymbolId, number> {
  const counts = Object.fromEntries(SYMBOLS.map((symbol) => [symbol, 0])) as Record<
    SymbolId,
    number
  >;
  const seat = state.players[player];
  if (seat.partyId) {
    counts[getParty(seat.partyId).symbol] += 1;
  }
  for (const monument of seat.monuments) {
    const def = getCard(monument.cardId);
    if (def.kind !== CardKind.Monument) continue;
    for (const symbol of def.symbols) {
      counts[symbol] += 1;
    }
  }
  for (const district of DISTRICTS) {
    const policyId = state.policy[district];
    if (!policyId) continue;
    const policy = getCard(policyId);
    if (policy.kind !== CardKind.Policy) continue;
    counts[policy.symbol] += 1;
  }
  return counts;
}

/**
 * Immediate victories only (Military, Popularity, Ideological).
 * Order when several trip on one action: Popularity (district order),
 * Ideological (symbol order), Military. Civil / Political wait for Phase 5.
 */
export function checkVictory(state: GameState): Victory | null {
  for (const district of state.districtOrder) {
    const lead =
      state.players[0].support[district].length -
      state.players[1].support[district].length;
    if (lead >= POPULARITY_LEAD) {
      return { kind: VictoryKind.Popularity, player: 0, district };
    }
    if (lead <= -POPULARITY_LEAD) {
      return { kind: VictoryKind.Popularity, player: 1, district };
    }
  }

  const counts = PLAYERS.map((player) => symbolCounts(state, player));
  for (const symbol of SYMBOLS) {
    const a = counts[0]![symbol];
    const b = counts[1]![symbol];
    if (a >= IDEOLOGICAL_COUNT && b < IDEOLOGICAL_COUNT) {
      return { kind: VictoryKind.Ideological, player: 0, symbol };
    }
    if (b >= IDEOLOGICAL_COUNT && a < IDEOLOGICAL_COUNT) {
      return { kind: VictoryKind.Ideological, player: 1, symbol };
    }
  }

  const military = state.players[0].partisans - state.players[1].partisans;
  if (military >= MILITARY_LEAD) {
    return { kind: VictoryKind.Military, player: 0 };
  }
  if (military <= -MILITARY_LEAD) {
    return { kind: VictoryKind.Military, player: 1 };
  }

  return null;
}

export function resolveVictory(state: GameState, events: GameEvent[]): Victory | null {
  if (state.victory) return state.victory;
  const victory = checkVictory(state);
  if (!victory) return null;
  state.victory = victory;
  state.phase = Phase.GameOver;
  events.push({ type: "victory", victory });
  return victory;
}
