import { getCard } from "../cards/catalog.ts";
import { CardKind, DISTRICTS, type DecreeIdValue, type DistrictId } from "../cards/schema.ts";
import { EffectId } from "../cards/effects.ts";
import { District, MonumentId } from "../cards/schema.ts";
import { activeAlliances, hasActiveAlliance, ownsMonument } from "./abilities.ts";
import { inactiveDecrees } from "./decrees.ts";
import { discardCards } from "./discard.ts";
import { replenishMarket } from "./draw.ts";
import { playerDistrictInfluence } from "./influence.ts";
import {
  ElectionTieBreak,
  Phase,
  PLAYERS,
  VictoryKind,
  type ElectionRuntime,
  type ElectionTieBreakId,
  type GameEvent,
  type GameState,
  type PlayerId,
} from "./types.ts";
import { endGame } from "./victory.ts";
import { emptyTurn, otherPlayer } from "./zones.ts";

export const GENERAL_ELECTION_COUNT = 4;

export function createEmptyElection(): ElectionRuntime {
  return {
    active: false,
    needsOpening: false,
    generalElections: 0,
    lastWinner: null,
  };
}

export type ElectorateResult = {
  winner: PlayerId | null;
  electors: number;
  influence: [number, number];
};

export type LordsResult = {
  winner: PlayerId | null;
  electors: number;
  symbols: [number, number];
};

export type ElectionTally = {
  districts: Record<DistrictId, ElectorateResult>;
  lords: LordsResult;
  electorates: [number, number];
  electors: [number, number];
  winner: PlayerId;
  tieBreak: ElectionTieBreakId;
};

export function civilElectorsInDistrict(state: GameState, district: DistrictId): number {
  let count = 0;
  for (const player of PLAYERS) {
    count += state.players[player].tableau[district].filter(
      (card) => getCard(card.cardId).kind === CardKind.Civil,
    ).length;
  }
  return count;
}

export function allianceCardsInPlay(state: GameState): number {
  let count = 0;
  for (const player of PLAYERS) {
    for (const district of DISTRICTS) {
      count += state.players[player].tableau[district].filter(
        (card) => getCard(card.cardId).kind === CardKind.Alliance,
      ).length;
    }
  }
  return count;
}

export function lordsSymbols(state: GameState, player: PlayerId): number {
  let symbols = 0;
  for (const district of DISTRICTS) {
    for (const card of state.players[player].tableau[district]) {
      const def = getCard(card.cardId);
      if (def.kind === CardKind.Alliance) {
        symbols += def.allianceSymbols;
      }
    }
  }
  return symbols;
}

export function tallyElection(state: GameState): ElectionTally {
  const districts = {} as Record<DistrictId, ElectorateResult>;
  const electorates: [number, number] = [0, 0];
  const electors: [number, number] = [0, 0];

  for (const district of state.districtOrder) {
    const influence = PLAYERS.map(
      (player) => playerDistrictInfluence(state, player, district).total,
    ) as [number, number];
    const districtElectors = civilElectorsInDistrict(state, district);
    let winner: PlayerId | null = null;
    if (influence[0] > influence[1]) winner = 0;
    else if (influence[1] > influence[0]) winner = 1;
    winner = districtOverride(state, district, winner);
    districts[district] = { winner, electors: districtElectors, influence };
    if (winner !== null) {
      electorates[winner] += 1;
      electors[winner] += districtElectors;
    }
  }

  const symbols = PLAYERS.map((player) => lordsSymbols(state, player)) as [number, number];
  const lordsElectors = allianceCardsInPlay(state);
  let lordsWinner: PlayerId | null = null;
  if (symbols[0] > symbols[1]) lordsWinner = 0;
  else if (symbols[1] > symbols[0]) lordsWinner = 1;
  if (lordsWinner !== null) {
    electorates[lordsWinner] += 1;
    electors[lordsWinner] += lordsElectors;
  }

  const { winner, tieBreak } = resolveElectionWinner(state, electorates, electors);

  return {
    districts,
    lords: { winner: lordsWinner, electors: lordsElectors, symbols },
    electorates,
    electors,
    winner,
    tieBreak,
  };
}

/**
 * Alliance and monument effects that decide a district regardless of influence:
 * Diet of Saints and Divine Inquisitors (Shavvinne), then Civil Service as a veto.
 */
export function districtOverride(
  state: GameState,
  district: DistrictId,
  byInfluence: PlayerId | null,
): PlayerId | null {
  let winner = byInfluence;
  if (district === District.Shavvinne) {
    const claims = new Set<PlayerId>();
    for (const player of PLAYERS) {
      // Diet of Saints: "You always have higher influence in Shavvinne."
      if (hasActiveAlliance(state, player, EffectId.AlwaysHigherInfluenceDiscardCivilAfterElection, District.Shavvinne)) {
        claims.add(player);
      }
    }
    // Divine Inquisitors: "You win Shavvinne during elections if this is the only alliance card in the district."
    const inShavvinne = activeAlliances(state).filter((alliance) => alliance.occupied === District.Shavvinne);
    const allInShavvinne = PLAYERS.flatMap((player) =>
      state.players[player].tableau[District.Shavvinne].filter((card) => getCard(card.cardId).kind === CardKind.Alliance),
    );
    const inquisitor = inShavvinne.find((alliance) => alliance.effectIds.includes(EffectId.WinIfOnlyAlliance));
    if (inquisitor && allInShavvinne.length === 1) claims.add(inquisitor.owner);
    // Conflicting claims (both players) cancel out: nobody wins the district.
    if (claims.size === 1) winner = [...claims][0]!;
    else if (claims.size === 2) winner = null;
  }
  // Civil Service: "Opponent cannot win a district where they don't have more civil cards."
  if (winner !== null) {
    const owner = otherPlayer(winner);
    if (ownsMonument(state, owner, MonumentId.CivilService) && civilCount(state, winner, district) <= civilCount(state, owner, district)) {
      winner = null;
    }
  }
  return winner;
}

function civilCount(state: GameState, player: PlayerId, district: DistrictId): number {
  return state.players[player].tableau[district].filter((card) => getCard(card.cardId).kind === CardKind.Civil).length;
}

/** Electorates → cards in won electorates → incumbent → first player (first election). */
function resolveElectionWinner(
  state: GameState,
  electorates: [number, number],
  electors: [number, number],
): { winner: PlayerId; tieBreak: ElectionTieBreakId } {
  if (electorates[0] !== electorates[1]) {
    return { winner: electorates[0] > electorates[1] ? 0 : 1, tieBreak: ElectionTieBreak.Electorates };
  }
  if (electors[0] !== electors[1]) {
    return { winner: electors[0] > electors[1] ? 0 : 1, tieBreak: ElectionTieBreak.Electors };
  }
  if (state.election.lastWinner !== null) {
    return { winner: state.election.lastWinner, tieBreak: ElectionTieBreak.Incumbent };
  }
  if (state.firstPlayer === null) {
    throw new Error("First election tie-break needs a setup first player");
  }
  return { winner: state.firstPlayer, tieBreak: ElectionTieBreak.FirstPlayer };
}

/** The last General Election has left the deck: this election is the final one. */
export function isFinalElection(state: GameState): boolean {
  return state.electionsOut.length >= GENERAL_ELECTION_COUNT;
}

/** End of a turn. Resolves the election if the Market ran dry, else passes play on. */
export function finishTurn(state: GameState, events: GameEvent[]): void {
  if (state.phase === Phase.GameOver) return;
  const nextPlayer = otherPlayer(state.activePlayer);
  state.turn = emptyTurn();
  state.flags = {};

  if (state.election.active && state.market.length === 0) {
    resolveElection(state, nextPlayer, events);
    return;
  }

  startTurn(state, nextPlayer, events);
}

function startTurn(state: GameState, player: PlayerId, events: GameEvent[]): void {
  state.activePlayer = player;
  state.phase = Phase.Action;
  events.push({ type: "turnEnded", nextPlayer: player });
}

export function resolveElection(state: GameState, nextPlayer: PlayerId, events: GameEvent[]): void {
  const tally = tallyElection(state);
  events.push({
    type: "electionTallied",
    electorates: tally.electorates,
    electors: tally.electors,
    winner: tally.winner,
    tieBreak: tally.tieBreak,
  });

  const winner = tally.winner;
  state.players[winner].electionWins += 1;
  state.election.lastWinner = winner;
  events.push({ type: "electionWon", player: winner, wins: state.players[winner].electionWins });

  // Diet of Saints: "Discard ALL civil cards in Shavvinne after an election" (both players').
  const dietOwner = PLAYERS.find((player) =>
    hasActiveAlliance(state, player, EffectId.AlwaysHigherInfluenceDiscardCivilAfterElection, District.Shavvinne),
  );
  if (dietOwner !== undefined) {
    for (const owner of PLAYERS) {
      const lane = state.players[owner].tableau[District.Shavvinne];
      const civils = lane.filter((card) => getCard(card.cardId).kind === CardKind.Civil);
      state.players[owner].tableau[District.Shavvinne] = lane.filter((card) => !civils.includes(card));
      discardCards(state, owner, civils.map((card) => ({ card, owner })), events, { reroutable: false });
    }
  }

  const generalElections = state.election.generalElections;
  state.election.active = false;
  state.election.needsOpening = false;
  state.election.generalElections = 0;

  if (isFinalElection(state)) {
    endGame(state, { kind: VictoryKind.Civil, player: winner }, events);
    return;
  }

  const owed = Math.min(generalElections, inactiveDecrees(state).length);
  if (owed > 0) {
    state.pendingDecrees = { player: winner, remaining: owed, nextPlayer };
    state.phase = Phase.DecreeChoice;
    state.activePlayer = winner;
    events.push({ type: "decreeChoiceNeeded", player: winner, count: owed });
    return;
  }

  finishElection(state, nextPlayer, events);
}

export function activateDecree(
  state: GameState,
  player: PlayerId,
  decreeId: DecreeIdValue,
  events: GameEvent[],
): void {
  const pending = state.pendingDecrees;
  if (state.phase !== Phase.DecreeChoice || !pending) {
    throw new Error("No decree activation is pending");
  }
  if (pending.player !== player) {
    throw new Error("Only the election winner activates decrees");
  }
  const decree = state.decrees.find((entry) => entry.id === decreeId);
  if (!decree) throw new Error(`Unknown decree ${decreeId}`);
  if (decree.active) throw new Error("That decree is already active");

  decree.active = true;
  pending.remaining -= 1;
  events.push({ type: "decreeActivated", player, decreeId });
  if (pending.remaining === 0) {
    finishElection(state, pending.nextPlayer, events);
  }
}

function finishElection(state: GameState, nextPlayer: PlayerId, events: GameEvent[]): void {
  state.pendingDecrees = null;
  events.push({ type: "electionEnded" });
  // Normal turn order resumes. Refilling to 5 may reveal another General Election,
  // which opens the next phase right away.
  replenishMarket(state, events);
  startTurn(state, nextPlayer, events);
}
