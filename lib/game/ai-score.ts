/**
 * How the computer judges a position (lib/game/ai.ts searches with it): from public information
 * plus its own hand, never the opponent's hand.
 */
import { getCard } from "../cards/catalog.ts";
import { CardKind, DecreeId, type DistrictId } from "../cards/schema.ts";
import { meetsDecree } from "./decrees.ts";
import { isFinalElection, lordsSymbols, tallyElection } from "./election.ts";
import { playerDistrictInfluence } from "./influence.ts";
import { canRecruitIn } from "./main.ts";
import { victoryRace } from "./progress.ts";
import type { GameState, PlayerId, VictoryKindId } from "./types.ts";
import { otherPlayer } from "./zones.ts";

/** What each part of the board is worth. */
export type Weights = {
  /** Each victory's progress (0 → 1 of the way to its target). */
  victory: Record<VictoryKindId, number>;
  /** Its own progress is raised to this power: above 1, the last steps to a victory count for more. */
  commit: number;
  /** A victory it could declare next Politics step, and one the opponent could. */
  met: number;
  opponentMet: number;
  /**
   * A victory within reach: the opponent's (a penalty) and its own (a bonus), worth the most
   * one step away. Popularity counts as within reach `popularityReach` support away (a recruit
   * adds 3); the rest one step away.
   */
  opponentNear: number;
  selfNear: number;
  popularityReach: number;
  /** Electorates and electors it leads by, and elections won. */
  electorates: number;
  electors: number;
  electionWins: number;
  /** Each district's margin, flattened by `districtScale` (a safe lead isn't worth piling into). */
  district: number;
  districtScale: number;
  monuments: number;
  lords: number;
  /** Cards in hand (up to 7), and its own hand's plans. */
  hand: number;
  handCivil: number;
  handSet: number;
  handRecruit: number;
  handMonument: number;
  /**
   * Plans an agenda pursues (0 for none): cards toward a monument in the district it's
   * closest to building in, cards toward a recruit where it has support, and decrees (active
   * or not) whose condition it meets.
   */
  monumentPlan: number;
  recruitPlan: number;
  decreeReady: number;
};

/** The weights Easy and Normal play by. */
export const CLASSIC: Weights = {
  victory: { civil: 0, political: 45, military: 40, popularity: 30, ideological: 30, cultural: 30, diplomatic: 30 },
  commit: 1,
  met: 400,
  opponentMet: 600,
  opponentNear: 60,
  selfNear: 0,
  popularityReach: 1,
  electorates: 10,
  electors: 0.4,
  electionWins: 15,
  district: 7,
  districtScale: 5,
  monuments: 6,
  lords: 2,
  hand: 1.5,
  handCivil: 0.25,
  handSet: 0.5,
  handRecruit: 4,
  handMonument: 5,
  monumentPlan: 0,
  recruitPlan: 0,
  decreeReady: 0,
};

/**
 * How good a position is for `seat`: winning, victory progress (and the opponent's threats),
 * the election outlook, district influence, monuments, Lords, and cards in hand.
 */
export function positionScore(state: GameState, seat: PlayerId, w: Weights = CLASSIC): number {
  const opponent = otherPlayer(seat);
  if (state.victory) return state.victory.player === seat ? 1e6 : -1e6;
  if (state.phase === "setup") return 0;

  let score = 0;
  const race = victoryRace(state);
  for (const row of race.rows) {
    if (!row.active) continue;
    const progress = (standing: { value: number; target: number }) => Math.max(-1, Math.min(1, standing.value / standing.target));
    const mine = progress(row.standing[seat]);
    score += w.victory[row.kind] * ((mine > 0 ? mine ** w.commit : mine) - progress(row.standing[opponent]));
    // A victory either player could declare next Politics step is decisive.
    if (row.standing[seat].met) score += w.met;
    else score += w.selfNear * nearness(row.standing[seat], row.kind, w);
    if (row.standing[opponent].met) score -= w.opponentMet;
    else score -= w.opponentNear * nearness(row.standing[opponent], row.kind, w);
  }

  // The election: electorates now, more so while one is under way and when it's the last.
  const tally = tallyElection(state);
  // As an election's Market runs down, its result is closer to settled.
  const closing = state.election.active ? 1 + Math.max(0, 8 - state.market.length) / 8 : 1;
  const stakes = (state.election.active ? 2 : 1) * closing * (isFinalElection(state) ? 3 : 1);
  score += stakes * w.electorates * (tally.electorates[seat] - tally.electorates[opponent]);
  score += stakes * w.electors * (tally.electors[seat] - tally.electors[opponent]);
  score += w.electionWins * (state.players[seat].electionWins - state.players[opponent].electionWins);

  // Districts: holding one is what counts, so a close district is worth fighting over and a
  // safely won one isn't worth piling into (tanh flattens big margins).
  for (const district of state.districtOrder) {
    const margin =
      playerDistrictInfluence(state, seat, district).total - playerDistrictInfluence(state, opponent, district).total;
    score += stakes * w.district * Math.tanh(margin / w.districtScale);
  }
  score += w.monuments * (state.players[seat].monuments.length - state.players[opponent].monuments.length);
  score += w.lords * (lordsSymbols(state, seat) - lordsSymbols(state, opponent));
  // Cards in hand are options; the opponent's hand only counts by size (its faces are hidden).
  score += w.hand * (Math.min(state.players[seat].hand.length, 7) - Math.min(state.players[opponent].hand.length, 7));
  score += handPlans(state, seat, w);
  if (w.monumentPlan || w.recruitPlan) score += agendaPlans(state, seat, w);
  if (w.decreeReady) score += w.decreeReady * DECREE_IDS.filter((decree) => meetsDecree(state, seat, decree)).length;
  return score;
}

const DECREE_IDS = Object.values(DecreeId);

/**
 * An agenda's plans for its hand and network (both usable for recruits and monuments): the
 * district it's closest to a monument in (up to 5 cards), and the one it's closest to a
 * recruit in among those it has support in (up to 3).
 */
function agendaPlans(state: GameState, seat: PlayerId, w: Weights): number {
  const counts = new Map<DistrictId, number>();
  for (const card of [...state.players[seat].hand, ...state.players[seat].network]) {
    const def = getCard(card.cardId);
    if ("district" in def) counts.set(def.district, (counts.get(def.district) ?? 0) + 1);
  }
  let monument = 0;
  for (const available of state.availableMonuments) {
    const def = getCard(available.cardId);
    if ("district" in def) monument = Math.max(monument, Math.min(5, counts.get(def.district) ?? 0));
  }
  let recruit = 0;
  for (const [district, count] of counts) if (canRecruitIn(state, seat, district)) recruit = Math.max(recruit, Math.min(3, count));
  return w.monumentPlan * monument ** 1.3 + w.recruitPlan * recruit;
}

/** 1 a step from the target, falling to 0 beyond reach. */
function nearness(standing: { value: number; target: number }, kind: VictoryKindId, w: Weights): number {
  const reach = kind === "popularity" ? w.popularityReach : 1;
  const gap = standing.target - standing.value;
  return gap >= 1 && gap <= reach ? 1 - (gap - 1) / reach : 0;
}

/**
 * Its own hand (which it may look at): cards of one district work together. Three make a
 * recruit (if it already has support there), five a monument (if one of that district is
 * available to build).
 */
function handPlans(state: GameState, seat: PlayerId, w: Weights): number {
  const counts = new Map<DistrictId, number>();
  let score = 0;
  for (const card of state.players[seat].hand) {
    const def = getCard(card.cardId);
    if ("district" in def) counts.set(def.district, (counts.get(def.district) ?? 0) + 1);
    // Strong civil cards in hand are future influence.
    if (def.kind === CardKind.Civil) score += w.handCivil * def.influence;
  }
  for (const [district, count] of counts) {
    score += w.handSet * Math.min(count, 5) ** 1.4;
    if (count >= 3 && canRecruitIn(state, seat, district)) score += w.handRecruit; // counts zeroed support as none
    const buildable = state.availableMonuments.some((monument) => {
      const def = getCard(monument.cardId);
      return "district" in def && def.district === district;
    });
    if (count >= 5 && buildable) score += w.handMonument;
  }
  return score;
}
