/**
 * A computer opponent that plays any seat, using only the engine's legal moves.
 *
 * - "easy": usually does something rather than passing, picked at random; takes a win when offered.
 * - "normal": plays the move that looks best one step ahead, and now and then settles for
 *   one of its next best.
 * - "hard": plans its whole turn ahead (a short search over its own decisions) and plays
 *   the first move of the best plan.
 *
 * Fair play: moves are tried on a copy whose hidden piles (draw deck, monument deck, event
 * deck) are reshuffled, so simulating a draw tells it nothing about the real next card, and
 * the position score never looks at the opponent's hand.
 */
import { getCard } from "../cards/catalog.ts";
import { CardKind, type DistrictId } from "../cards/schema.ts";
import { apply, currentActor, legalActions } from "./engine.ts";
import { isFinalElection, lordsSymbols, tallyElection } from "./election.ts";
import { playerDistrictInfluence } from "./influence.ts";
import { victoryRace } from "./progress.ts";
import type { Rng } from "./rng.ts";
import { type Action, type GameState, type PlayerId, type VictoryKindId } from "./types.ts";
import { otherPlayer } from "./zones.ts";

export type AiLevel = "easy" | "normal" | "hard";

/** Each level is a character: a name for the table and lines to show while it decides. */
export type AiPersona = {
  /** Shown as the player's name (fits the 20-character name limit). */
  name: string;
  /** One-line personality, for the difficulty picker. */
  tagline: string;
  /** "… is thinking" lines, rotated move by move. */
  thinking: readonly string[];
};

export const AI_LEVELS: readonly { id: AiLevel; name: string; blurb: string; persona: AiPersona }[] = [
  {
    id: "easy",
    name: "Easy",
    blurb: "Plays loosely. Good for learning the rules.",
    persona: {
      name: "Mayor Mildred",
      tagline: "Means well. Mostly.",
      thinking: [
        "Mayor Mildred is shuffling her notes…",
        "Mayor Mildred is looking for her glasses…",
        "Mayor Mildred is asking the room for advice…",
        "Mayor Mildred is counting votes on her fingers…",
        "Mayor Mildred is cutting a ribbon somewhere…",
      ],
    },
  },
  {
    id: "normal",
    name: "Normal",
    blurb: "Solid play, with the odd slip.",
    persona: {
      name: "Chancellor Crane",
      tagline: "Patient, precise, and always one vote ahead.",
      thinking: [
        "Chancellor Crane is counting votes…",
        "Chancellor Crane is consulting the Senate…",
        "Chancellor Crane is drafting a policy…",
        "Chancellor Crane is calling in a favor…",
        "Chancellor Crane is weighing the options…",
      ],
    },
  },
  {
    id: "hard",
    name: "Hard",
    blurb: "Plans its whole turn before it moves.",
    persona: {
      name: "Grand Vizier Vex",
      tagline: "Three moves ahead, and counting yours.",
      thinking: [
        "Grand Vizier Vex is pulling some strings…",
        "Grand Vizier Vex is rehearsing the next three moves…",
        "Grand Vizier Vex is consulting the archives…",
        "Grand Vizier Vex is smiling at the Senate…",
        "Grand Vizier Vex is rearranging the ballots…",
      ],
    },
  },
];

export function aiPersona(level: AiLevel): AiPersona {
  return AI_LEVELS.find((entry) => entry.id === level)!.persona;
}

export function isAiLevel(value: unknown): value is AiLevel {
  return value === "easy" || value === "normal" || value === "hard";
}

/** Which seat the computer plays, and how well. */
export type AiOpponent = { seat: PlayerId; level: AiLevel };

const QUIET = new Set<Action["type"]>(["endAction", "endPolitics"]);

/** The computer's move for `seat` (which must be the current actor), or null if it has none. */
export function chooseAiAction(state: GameState, seat: PlayerId, level: AiLevel, rng: Rng): Action | null {
  if (state.victory || currentActor(state) !== seat) return null;
  const options = legalActions(state, seat);
  if (options.length === 0) return null;
  if (options.length === 1) return options[0]!;

  // Any level takes a victory the moment it can.
  const win = options.find((action) => action.type === "declareVictory");
  if (win) return win;

  if (level === "easy") {
    const busy = options.filter((action) => !QUIET.has(action.type));
    // Mostly random but active; now and then a sensible move so it isn't hopeless.
    if (rng.nextInt(3) === 0) return bestAction(state, seat, options, rng);
    const pool = busy.length > 0 && rng.nextInt(5) > 0 ? busy : options;
    return pool[rng.nextInt(pool.length)]!;
  }
  if (level === "normal") {
    // The best-looking move one step ahead; now and then one of the next best instead.
    const ranked = rankActions(state, seat, options, rng);
    return rng.nextInt(SLIP_ONE_IN) === 0 ? ranked[rng.nextInt(Math.min(3, ranked.length))]! : ranked[0]!;
  }
  return planTurn(state, seat, rng) ?? bestAction(state, seat, options, rng);
}

/** Normal: how often it settles for one of its top three moves instead of the best. */
const SLIP_ONE_IN = 4;

/** Hard: how many partial turns to keep at each step, and how many decisions ahead to look. */
const BEAM = 6;
const DEPTH = 8;

/**
 * Hard: plan the rest of this turn. Grow sequences of its own decisions (main action, free
 * actions, politics, income) step by step, keeping the most promising few, until the turn
 * passes or the game ends; then return the first move of the best finished sequence.
 */
function planTurn(state: GameState, seat: PlayerId, rng: Rng): Action | null {
  const size = { beam: BEAM, depth: DEPTH };
  type Node = { state: GameState; first: Action | null; score: number };
  let beam: Node[] = [{ state: withHiddenPilesShuffled(state, rng), first: null, score: 0 }];
  const finished: Node[] = [];
  for (let depth = 0; depth < size.depth && beam.length > 0; depth++) {
    const next: Node[] = [];
    for (const node of beam) {
      for (const action of legalActions(node.state, seat)) {
        let child: GameState;
        try {
          child = apply(node.state, action, rng).state;
        } catch {
          continue;
        }
        const entry = { state: child, first: node.first ?? action, score: positionScore(child, seat) + rng.nextInt(1000) / 1e6 };
        // The turn is over (or the game): this sequence is done.
        if (child.victory || currentActor(child) !== seat) finished.push(entry);
        else next.push(entry);
      }
    }
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, size.beam);
  }
  finished.push(...beam);
  let best: Node | null = null;
  for (const node of finished) if (node.first && (!best || node.score > best.score)) best = node;
  return best?.first ?? null;
}

function bestAction(state: GameState, seat: PlayerId, options: readonly Action[], rng: Rng): Action {
  return rankActions(state, seat, options, rng)[0]!;
}

/** Options from best to worst, judged one step ahead (never empty when `options` isn't). */
function rankActions(state: GameState, seat: PlayerId, options: readonly Action[], rng: Rng): Action[] {
  const fair = withHiddenPilesShuffled(state, rng);
  const scored: { action: Action; score: number }[] = [];
  for (const action of options) {
    try {
      // A hair of noise so equal moves don't always resolve the same way.
      scored.push({ action, score: positionScore(apply(fair, action, rng).state, seat) + rng.nextInt(1000) / 1e6 });
    } catch {
      continue;
    }
  }
  if (scored.length === 0) return [options[0]!];
  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.action);
}

/** A copy for trying moves on, with the piles nobody can see reshuffled. */
function withHiddenPilesShuffled(state: GameState, rng: Rng): GameState {
  const copy = structuredClone(state);
  shuffle(copy.deck, rng);
  shuffle(copy.monumentDeck, rng);
  if (copy.expansion) shuffle(copy.expansion.eventDeck, rng);
  return copy;
}

function shuffle<T>(items: T[], rng: Rng): void {
  for (let index = items.length - 1; index > 0; index--) {
    const swap = rng.nextInt(index + 1);
    [items[index], items[swap]] = [items[swap]!, items[index]!];
  }
}

/** How much each victory's progress is worth (0 → 1 of the way to the target). */
const VICTORY_WEIGHT: Record<VictoryKindId, number> = {
  civil: 0,
  political: 45,
  military: 40,
  popularity: 30,
  ideological: 30,
  cultural: 30,
  diplomatic: 30,
};

/**
 * How good a position is for `seat`, from public information plus its own hand size:
 * winning, victory progress (and the opponent's threats), the election outlook, district
 * influence, monuments, Lords, and cards in hand.
 */
export function positionScore(state: GameState, seat: PlayerId): number {
  const opponent = otherPlayer(seat);
  if (state.victory) return state.victory.player === seat ? 1e6 : -1e6;
  if (state.phase === "setup") return 0;

  let score = 0;
  const race = victoryRace(state);
  for (const row of race.rows) {
    if (!row.active) continue;
    const weight = VICTORY_WEIGHT[row.kind];
    const progress = (standing: { value: number; target: number }) => Math.max(-1, Math.min(1, standing.value / standing.target));
    score += weight * (progress(row.standing[seat]) - progress(row.standing[opponent]));
    // A victory either player could declare next Politics step is decisive.
    if (row.standing[seat].met) score += 400;
    if (row.standing[opponent].met) score -= 600;
    else if (row.standing[opponent].target - row.standing[opponent].value === 1) score -= 60;
  }

  // The election: electorates now, more so while one is under way and when it's the last.
  const tally = tallyElection(state);
  // As an election's Market runs down, its result is closer to settled.
  const closing = state.election.active ? 1 + Math.max(0, 8 - state.market.length) / 8 : 1;
  const stakes = (state.election.active ? 2 : 1) * closing * (isFinalElection(state) ? 3 : 1);
  score += stakes * 10 * (tally.electorates[seat] - tally.electorates[opponent]);
  score += stakes * 0.4 * (tally.electors[seat] - tally.electors[opponent]);
  score += 15 * (state.players[seat].electionWins - state.players[opponent].electionWins);

  // Districts: holding one is what counts, so a close district is worth fighting over and a
  // safely won one isn't worth piling into (tanh flattens big margins).
  for (const district of state.districtOrder) {
    const margin =
      playerDistrictInfluence(state, seat, district).total - playerDistrictInfluence(state, opponent, district).total;
    score += stakes * 7 * Math.tanh(margin / 5);
  }
  score += 6 * (state.players[seat].monuments.length - state.players[opponent].monuments.length);
  score += 2 * (lordsSymbols(state, seat) - lordsSymbols(state, opponent));
  // Cards in hand are options; the opponent's hand only counts by size (its faces are hidden).
  score += 1.5 * Math.min(state.players[seat].hand.length, 7) - 1.5 * Math.min(state.players[opponent].hand.length, 7);
  score += handPlans(state, seat);
  return score;
}

/**
 * Its own hand (which it may look at): cards of one district work together. Three make a
 * recruit (if it already has support there), five a monument (if one of that district is
 * available to build).
 */
function handPlans(state: GameState, seat: PlayerId): number {
  const counts = new Map<string, number>();
  for (const card of state.players[seat].hand) {
    const def = getCard(card.cardId);
    if ("district" in def) counts.set(def.district, (counts.get(def.district) ?? 0) + 1);
  }
  let score = 0;
  // Strong civil cards in hand are future influence.
  for (const card of state.players[seat].hand) {
    const def = getCard(card.cardId);
    if (def.kind === CardKind.Civil) score += 0.25 * def.influence;
  }
  for (const [district, count] of counts) {
    score += 0.5 * Math.min(count, 5) ** 1.4;
    const supported = state.players[seat].support[district as DistrictId].length > 0;
    if (count >= 3 && supported) score += 4;
    const buildable = state.availableMonuments.some((monument) => {
      const def = getCard(monument.cardId);
      return "district" in def && def.district === district;
    });
    if (count >= 5 && buildable) score += 5;
  }
  return score;
}
