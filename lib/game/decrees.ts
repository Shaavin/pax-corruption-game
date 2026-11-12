import { DECREES, getCard } from "../cards/catalog.ts";
import { CardKind, DecreeId, DISTRICTS, type DecreeIdValue, type DistrictId } from "../cards/schema.ts";
import { playerDistrictInfluence } from "./influence.ts";
import type { DecreeState, GameState, PlayerId } from "./types.ts";
import { otherPlayer } from "./zones.ts";

export const PROFECTUS_SUPPORT_LEAD = 7;
export const ACADEMIA_INFLUENCE_LEAD = 20;

export function initialDecrees(): DecreeState[] {
  return DECREES.map((decree) => ({ id: decree.id, active: false }));
}

export function activeDecrees(state: GameState): DecreeIdValue[] {
  return state.decrees.filter((decree) => decree.active).map((decree) => decree.id);
}

export function inactiveDecrees(state: GameState): DecreeIdValue[] {
  return state.decrees.filter((decree) => !decree.active).map((decree) => decree.id);
}

function totalSupport(state: GameState, player: PlayerId): number {
  return DISTRICTS.reduce(
    (sum, district) => sum + state.players[player].support[district].length,
    0,
  );
}

function lowestCivil(state: GameState, player: PlayerId, district: DistrictId): number | null {
  let lowest: number | null = null;
  for (const card of state.players[player].tableau[district]) {
    const def = getCard(card.cardId);
    if (def.kind !== CardKind.Civil) continue;
    if (lowest === null || def.influence < lowest) lowest = def.influence;
  }
  return lowest;
}

/**
 * De Jures, per district: lower or tied lowest civil card passes. No civil
 * cards fails, unless neither player has any (a tie, so both pass).
 * Ruled 2026-11-11.
 */
export function passesDeJuresIn(state: GameState, player: PlayerId, district: DistrictId): boolean {
  const mine = lowestCivil(state, player, district);
  const theirs = lowestCivil(state, otherPlayer(player), district);
  if (mine === null) return theirs === null;
  if (theirs === null) return true;
  return mine <= theirs;
}

/** Whether `player` currently meets a decree's printed condition (active or not). */
export function meetsDecree(state: GameState, player: PlayerId, decreeId: DecreeIdValue): boolean {
  const opponent = otherPlayer(player);
  switch (decreeId) {
    case DecreeId.Imperium:
      return state.players[player].partisans > state.players[opponent].partisans;
    case DecreeId.Profectus:
      return totalSupport(state, player) - totalSupport(state, opponent) >= PROFECTUS_SUPPORT_LEAD;
    case DecreeId.Academia:
      return DISTRICTS.some(
        (district) =>
          playerDistrictInfluence(state, player, district).total -
            playerDistrictInfluence(state, opponent, district).total >=
          ACADEMIA_INFLUENCE_LEAD,
      );
    case DecreeId.DeJures:
      return DISTRICTS.every((district) => passesDeJuresIn(state, player, district));
  }
}

/** Active decrees `player` satisfies right now. Two = Political Victory. */
export function satisfiedDecrees(state: GameState, player: PlayerId): DecreeIdValue[] {
  return activeDecrees(state).filter((id) => meetsDecree(state, player, id));
}

export function decreeSymbol(decreeId: DecreeIdValue) {
  const def = getCard(decreeId);
  if (def.kind !== CardKind.Decree) throw new Error(`${decreeId} is not a decree`);
  return def.symbol;
}
