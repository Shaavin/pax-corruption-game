import { getCard, getParty } from "../cards/catalog.ts";
import { CardKind, MonumentId, SYMBOLS, type SymbolId } from "../cards/schema.ts";
import { ownsMonument } from "./abilities.ts";
import { activeDecrees, decreeSymbol, satisfiedDecrees } from "./decrees.ts";
import { Phase, PLAYERS, VictoryKind, type GameEvent, type GameState, type PlayerId, type Victory } from "./types.ts";
import { otherPlayer } from "./zones.ts";

export const MILITARY_LEAD = 3;
export const POPULARITY_LEAD = 9;
export const IDEOLOGICAL_COUNT = 4;
export const POLITICAL_DECREES = 2;
export const ROMAN_BASILICA_WINS = 3;

type SymbolCounts = Record<SymbolId, number>;

function zeroCounts(): SymbolCounts {
  return Object.fromEntries(SYMBOLS.map((symbol) => [symbol, 0])) as SymbolCounts;
}


/** Private copies: party, built monuments, and Smart Doctrine (one per active decree symbol). */
export function privateSymbols(state: GameState, player: PlayerId): SymbolCounts {
  const counts = zeroCounts();
  const seat = state.players[player];
  if (seat.partyId) counts[getParty(seat.partyId).symbol] += 1;
  for (const monument of seat.monuments) {
    const def = getCard(monument.cardId);
    if (def.kind !== CardKind.Monument) continue;
    for (const symbol of def.symbols) counts[symbol] += 1;
  }
  if (ownsMonument(state, player, MonumentId.SmartDoctrine)) {
    for (const decreeId of activeDecrees(state)) counts[decreeSymbol(decreeId)] += 1;
  }
  return counts;
}

/** Shared copies: active district policies and active decrees. */
export function sharedSymbols(state: GameState): SymbolCounts {
  const counts = zeroCounts();
  for (const district of state.districtOrder) {
    const policyId = state.policy[district];
    if (!policyId) continue;
    const policy = getCard(policyId);
    if (policy.kind === CardKind.Policy) counts[policy.symbol] += 1;
  }
  for (const decreeId of activeDecrees(state)) counts[decreeSymbol(decreeId)] += 1;
  return counts;
}

/**
 * Total copies per symbol = shared + the private copies of whichever player
 * has more of that symbol (the other player's are ignored).
 */
export function totalSymbols(state: GameState): SymbolCounts {
  const shared = sharedSymbols(state);
  const mine = privateSymbols(state, 0);
  const theirs = privateSymbols(state, 1);
  const totals = zeroCounts();
  for (const symbol of SYMBOLS) {
    totals[symbol] = shared[symbol] + Math.max(mine[symbol], theirs[symbol]);
  }
  return totals;
}

/** The symbol `player` could declare Ideological Victory with, if any. */
export function ideologicalSymbol(state: GameState, player: PlayerId): SymbolId | null {
  const mine = privateSymbols(state, player);
  const theirs = privateSymbols(state, otherPlayer(player));
  const totals = totalSymbols(state);
  for (const symbol of SYMBOLS) {
    if (mine[symbol] <= theirs[symbol]) continue;
    if (totals[symbol] < IDEOLOGICAL_COUNT) continue;
    const beatsOthers = SYMBOLS.every((other) => other === symbol || totals[symbol] > totals[other]);
    if (beatsOthers) return symbol;
  }
  return null;
}

/** Victories `player` may declare in their Politics step right now. */
export function declarableVictories(state: GameState, player: PlayerId): Victory[] {
  const opponent = otherPlayer(player);
  const victories: Victory[] = [];

  if (
    ownsMonument(state, player, MonumentId.RomanBasilica) &&
    state.players[player].electionWins >= ROMAN_BASILICA_WINS
  ) {
    victories.push({ kind: VictoryKind.Civil, player });
  }
  if (satisfiedDecrees(state, player).length >= POLITICAL_DECREES) {
    victories.push({ kind: VictoryKind.Political, player });
  }
  if (state.players[player].partisans - state.players[opponent].partisans >= MILITARY_LEAD) {
    victories.push({ kind: VictoryKind.Military, player });
  }
  const district = state.districtOrder.find(
    (entry) =>
      state.players[player].support[entry].length -
        state.players[opponent].support[entry].length >=
      POPULARITY_LEAD,
  );
  if (district) victories.push({ kind: VictoryKind.Popularity, player, district });
  const symbol = ideologicalSymbol(state, player);
  if (symbol) victories.push({ kind: VictoryKind.Ideological, player, symbol });
  return victories;
}

export function sameVictory(a: Victory, b: Victory): boolean {
  return (
    a.kind === b.kind &&
    a.player === b.player &&
    (a.district ?? null) === (b.district ?? null) &&
    (a.symbol ?? null) === (b.symbol ?? null)
  );
}

export function endGame(state: GameState, victory: Victory, events: GameEvent[]): void {
  state.victory = victory;
  state.phase = Phase.GameOver;
  events.push({ type: "victory", victory });
}

/** For the UI: what each player could declare (does not end the game). */
export function victoryReadiness(state: GameState): Record<PlayerId, Victory[]> {
  return Object.fromEntries(
    PLAYERS.map((player) => [player, declarableVictories(state, player)]),
  ) as Record<PlayerId, Victory[]>;
}
