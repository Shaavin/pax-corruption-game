import { getCard } from "../cards/catalog.ts";
import {
  CardKind,
  DISTRICTS,
  ExecutiveSide,
  type DistrictId,
  type ExecutiveSideId,
} from "../cards/schema.ts";
import { ELECTION_MARKET_SIZE, fillMarket, MARKET_SIZE } from "./draw.ts";
import { districtInfluence } from "./influence.ts";
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
import { emptyTurn, otherPlayer } from "./zones.ts";
import { resolveVictory } from "./victory.ts";

export const FLAG_USED_EP = "usedExecutive";
export const POLITICAL_WINS = 3;
export const GENERAL_ELECTION_COUNT = 4;

export function createEmptyElection(): ElectionRuntime {
  return {
    active: false,
    pendingStart: false,
    skipReplenish: false,
    lastWinner: null,
    firstPlayer: null,
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
    const influence = PLAYERS.map((player) =>
      districtInfluence(
        state.players[player].tableau[district],
        state.players[player].support[district].length,
      ).total,
    ) as [number, number];
    const districtElectors = civilElectorsInDistrict(state, district);
    let winner: PlayerId | null = null;
    if (influence[0] > influence[1]) winner = 0;
    else if (influence[1] > influence[0]) winner = 1;
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

function resolveElectionWinner(
  state: GameState,
  electorates: [number, number],
  electors: [number, number],
): { winner: PlayerId; tieBreak: ElectionTieBreakId } {
  if (electorates[0] > electorates[1]) {
    return { winner: 0, tieBreak: ElectionTieBreak.Electorates };
  }
  if (electorates[1] > electorates[0]) {
    return { winner: 1, tieBreak: ElectionTieBreak.Electorates };
  }
  if (electors[0] > electors[1]) {
    return { winner: 0, tieBreak: ElectionTieBreak.Electors };
  }
  if (electors[1] > electors[0]) {
    return { winner: 1, tieBreak: ElectionTieBreak.Electors };
  }
  if (state.election.lastWinner !== null) {
    return { winner: state.election.lastWinner, tieBreak: ElectionTieBreak.Incumbent };
  }
  if (state.firstPlayer === null) {
    throw new Error("First election incumbency needs a setup first player");
  }
  return { winner: state.firstPlayer, tieBreak: ElectionTieBreak.PartyOrder };
}

export function opponentDiscardedLastTurn(state: GameState, player: PlayerId): boolean {
  return state.lastTurn.player === otherPlayer(player) && state.lastTurn.discarded;
}

function canUseExecutiveTiming(state: GameState, player: PlayerId): boolean {
  if (state.phase !== Phase.Politics) return false;
  if (state.activePlayer !== player) return false;
  if (state.flags[FLAG_USED_EP]) return false;
  if (state.election.active || state.election.pendingStart) return false;
  if (state.executive?.owner !== player) return false;
  return opponentDiscardedLastTurn(state, player);
}

export function canUseEmergencyState(state: GameState, player: PlayerId): boolean {
  return (
    canUseExecutiveTiming(state, player) &&
    state.executive?.side === ExecutiveSide.EmergencyState
  );
}

export function legalReviewTargets(state: GameState): DistrictId[] {
  return DISTRICTS.filter((district) => state.policy[district] !== null);
}

export function canUseLegalReview(state: GameState, player: PlayerId): boolean {
  return (
    canUseExecutiveTiming(state, player) &&
    state.executive?.side === ExecutiveSide.LegalReview &&
    legalReviewTargets(state).length > 0
  );
}

/** Why the held executive side cannot be used, or null if it is legal / not held. */
export function executiveBlockReason(state: GameState, player: PlayerId): string | null {
  if (state.executive?.owner !== player) return null;
  if (state.phase !== Phase.Politics) {
    return "Use this in the Politics step, after your main action";
  }
  if (state.election.active || state.election.pendingStart) {
    return "Cannot use executive power during an election";
  }
  if (state.flags[FLAG_USED_EP]) {
    return "Already used executive power this turn";
  }
  if (!opponentDiscardedLastTurn(state, player)) {
    return "Only the turn after the opponent discarded any card";
  }
  if (
    state.executive.side === ExecutiveSide.LegalReview &&
    legalReviewTargets(state).length === 0
  ) {
    return "All districts are already Neutral";
  }
  return null;
}

export function applyEmergencyState(state: GameState, player: PlayerId, events: GameEvent[]): void {
  if (!canUseEmergencyState(state, player)) {
    throw new Error("Emergency State is not legal now");
  }
  state.flags[FLAG_USED_EP] = true;
  state.electionTriggerer = player;
  state.election.pendingStart = true;
  state.election.skipReplenish = true;
  events.push({ type: "emergencyStateUsed", player });
}

export function applyLegalReview(
  state: GameState,
  player: PlayerId,
  district: DistrictId,
  events: GameEvent[],
): void {
  if (!canUseLegalReview(state, player)) {
    throw new Error("Legal Review is not legal now");
  }
  if (state.policy[district] === null) {
    throw new Error("That district is already Neutral");
  }
  state.flags[FLAG_USED_EP] = true;
  state.policy[district] = null;
  events.push({ type: "legalReviewUsed", player, district });
  events.push({ type: "policyChanged", district, policyId: null, player });
  resolveVictory(state, events);
}

export function finishTurn(state: GameState, events: GameEvent[]): void {
  if (state.phase === Phase.GameOver) return;
  state.lastTurn = { ...state.currentTurn, player: state.activePlayer };
  state.currentTurn = emptyTurn();
  state.flags = {};

  if (state.election.pendingStart) {
    startElectionPhase(state, events);
    return;
  }
  if (state.election.active && state.market.length === 0) {
    beginElectionEnd(state, events);
    return;
  }

  state.activePlayer = otherPlayer(state.activePlayer);
  state.phase = Phase.Action;
  events.push({ type: "turnEnded", nextPlayer: state.activePlayer });
}

export function startElectionPhase(state: GameState, events: GameEvent[]): void {
  state.election.pendingStart = false;
  state.election.active = true;
  state.election.skipReplenish = false;
  events.push({
    type: "electionStarted",
    triggerer: state.electionTriggerer ?? state.activePlayer,
  });

  fillMarket(state, ELECTION_MARKET_SIZE, events);
  state.executive = null;

  if (state.phase === Phase.GameOver) return;

  if (state.election.lastWinner === null) {
    const triggerer = state.electionTriggerer ?? state.activePlayer;
    beginElectionTurns(state, otherPlayer(triggerer), events);
    return;
  }

  const opposition = otherPlayer(state.election.lastWinner);
  state.phase = Phase.ElectionStart;
  state.activePlayer = opposition;
  events.push({ type: "electionFirstPlayerNeeded", player: opposition });
}

export function beginElectionTurns(
  state: GameState,
  firstPlayer: PlayerId,
  events: GameEvent[],
): void {
  state.election.active = true;
  state.election.firstPlayer = firstPlayer;
  state.activePlayer = firstPlayer;
  state.phase = Phase.Action;
  state.flags = {};
  state.currentTurn = emptyTurn();
  events.push({ type: "electionTurnsStarted", firstPlayer });
}

export function applyChooseElectionFirst(
  state: GameState,
  player: PlayerId,
  firstPlayer: PlayerId,
  events: GameEvent[],
): void {
  if (state.phase !== Phase.ElectionStart) {
    throw new Error("No election first-player choice is pending");
  }
  if (player !== state.activePlayer) {
    throw new Error("Only the opposition chooses who goes first");
  }
  if (firstPlayer !== 0 && firstPlayer !== 1) {
    throw new Error("firstPlayer must be 0 or 1");
  }
  beginElectionTurns(state, firstPlayer, events);
}

export function beginElectionEnd(state: GameState, events: GameEvent[]): void {
  state.election.active = false;
  state.election.skipReplenish = false;
  const tally = tallyElection(state);
  events.push({
    type: "electionTallied",
    electorates: tally.electorates,
    electors: tally.electors,
    winner: tally.winner,
    tieBreak: tally.tieBreak,
  });

  const winner = tally.winner;
  const loser = otherPlayer(winner);
  state.players[winner].electionWins += 1;
  state.players[winner].consecutiveWins += 1;
  state.players[loser].consecutiveWins = 0;
  state.election.lastWinner = winner;
  events.push({
    type: "electionWon",
    player: winner,
    consecutive: state.players[winner].consecutiveWins,
  });

  if (state.players[winner].consecutiveWins >= POLITICAL_WINS) {
    state.victory = { kind: VictoryKind.Political, player: winner };
    state.phase = Phase.GameOver;
    events.push({ type: "victory", victory: state.victory });
    return;
  }

  state.phase = Phase.ElectionEnd;
  state.activePlayer = winner;
}

export function applyChooseExecutiveSide(
  state: GameState,
  player: PlayerId,
  side: ExecutiveSideId,
  events: GameEvent[],
): void {
  if (state.phase !== Phase.ElectionEnd) {
    throw new Error("No executive-side choice is pending");
  }
  if (player !== state.activePlayer) {
    throw new Error("Only the election winner chooses the executive side");
  }
  if (state.executive) {
    throw new Error("Executive power has already been taken");
  }
  if (state.referendum) {
    throw new Error("The election referendum has already started");
  }
  if (side !== ExecutiveSide.EmergencyState && side !== ExecutiveSide.LegalReview) {
    throw new Error("Choose Emergency State or Legal Review");
  }

  state.executive = { owner: player, side };
  events.push({ type: "executiveTaken", player, side });
}

export function afterElectionReferendum(state: GameState, events: GameEvent[]): void {
  if (state.electionsOut.length >= GENERAL_ELECTION_COUNT) {
    const wins0 = state.players[0].electionWins;
    const wins1 = state.players[1].electionWins;
    const player: PlayerId =
      wins0 === wins1
        ? (state.election.lastWinner ?? 0)
        : wins0 > wins1
          ? 0
          : 1;
    state.victory = { kind: VictoryKind.Civil, player };
    state.phase = Phase.GameOver;
    events.push({ type: "victory", victory: state.victory });
    return;
  }

  const triggerer = state.electionTriggerer;
  const next = triggerer === null ? otherPlayer(state.activePlayer) : otherPlayer(triggerer);
  state.electionTriggerer = null;
  state.election.firstPlayer = null;
  state.activePlayer = next;
  state.flags = {};
  state.currentTurn = emptyTurn();

  fillMarket(state, MARKET_SIZE, events);
  events.push({ type: "electionEnded" });

  if (state.phase === Phase.GameOver) return;

  if (state.election.pendingStart) {
    startElectionPhase(state, events);
    return;
  }

  state.phase = Phase.Action;
}
