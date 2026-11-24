/**
 * A computer opponent that plays any seat, using only the engine's legal moves.
 *
 * - "easy": usually does something rather than passing, picked at random; takes a win when offered.
 * - "normal": plays the move that looks best one step ahead, and now and then settles for
 *   one of its next best.
 * - "hard": plans its whole turn ahead (a short search over its own decisions), plays the
 *   leading plans on through the opponent's reply and its own next turn, and plays the first
 *   move of the best.
 *
 * Positions are judged by `positionScore` (ai-score.ts). Each level also follows an agenda
 * (ai-agenda.ts): what it plays for this game, which shifts what counts most, so games against
 * it differ and it changes course when the board turns.
 *
 * Fair play: moves are tried on a copy whose hidden piles (draw deck, monument deck, event
 * deck) are reshuffled, so simulating a draw tells it nothing about the real next card. The
 * position score never looks at the opponent's hand, and Hard's look past its turn deals the
 * opponent a guessed hand from the cards it can't see (keeping the ones they took face up from
 * the Market).
 */
import { getCard } from "../cards/catalog.ts";
import { CardKind } from "../cards/schema.ts";
import { chooseAgenda, focusWeights, type AgendaId } from "./ai-agenda.ts";
import { CLASSIC, positionScore, type Weights } from "./ai-score.ts";
import { apply, currentActor, legalActions } from "./engine.ts";
import { createSeededRng, type Rng } from "./rng.ts";
import type { Action, GameState, PlayerId } from "./types.ts";
import { otherPlayer } from "./zones.ts";

export { positionScore, type Weights } from "./ai-score.ts";
export { Agenda, type AgendaId } from "./ai-agenda.ts";

export type AiLevel = "easy" | "normal" | "hard";

/** Each level is a character: a name for the table and lines to show while it decides. */
export type AiPersona = {
  /** Shown as the player's name (fits the 20-character name limit). */
  name: string;
  /** One-line personality, for the difficulty picker. */
  tagline: string;
  /** "… is thinking" lines, rotated move by move. */
  thinking: readonly string[];
  /** Their portrait (public/art/cast, made by scripts/make-cast-art.py) and the painting it's from. */
  portrait: string;
  portraitCredit: string;
  /** Their color, for the portrait's ring outside a game (in a game the seat's color rings it). */
  color: string;
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
      portrait: "/art/cast/mildred.webp",
      portraitCredit: "Portrait of a Lady, French or Swiss, 1725–50. Art Institute of Chicago (public domain).",
      color: "#d9a441",
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
      portrait: "/art/cast/crane.webp",
      portraitCredit: "Portrait of a Man, attributed to Nicolaes Maes, c. 1655. Art Institute of Chicago (public domain).",
      color: "#6f9fc8",
    },
  },
  {
    id: "hard",
    name: "Hard",
    blurb: "Plans past your reply to its next turn.",
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
      portrait: "/art/cast/vex.webp",
      portraitCredit: "An Old Man in a Fur Cap, Karel van der Pluym, c. 1655. Art Institute of Chicago (public domain).",
      color: "#a66bd3",
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

const QUIET = new Set<Action["type"]>(["endAction", "endPolitics", "passIncome", "toNetwork"]);

/**
 * The moves the computer considers. It never takes cards back out of its network
 * (they stay usable as if in hand), so in-and-out can't loop forever.
 */
function aiOptions(state: GameState, seat: PlayerId): Action[] {
  return legalActions(state, seat).filter((action) => action.type !== "fromNetwork");
}

/**
 * The computer's move for `seat` (which must be the current actor), or null if it has none.
 * `weights` overrides how it judges positions (for tuning).
 */
export function chooseAiAction(state: GameState, seat: PlayerId, level: AiLevel, rng: Rng, weights?: Weights): Action | null {
  if (state.victory || currentActor(state) !== seat) return null;
  const options = aiOptions(state, seat);
  if (options.length === 0) return null;
  if (options.length === 1) return options[0]!;

  // Any level takes a victory the moment it can.
  const win = options.find((action) => action.type === "declareVictory");
  if (win) return win;

  const w = weights ?? weightsFor(state, seat, level);
  if (level === "easy") {
    const busy = options.filter((action) => !QUIET.has(action.type));
    // Mostly random but active; now and then a sensible move so it isn't hopeless.
    if (rng.nextInt(3) === 0) return rankActions(state, seat, options, rng, w)[0]!;
    const pool = busy.length > 0 && rng.nextInt(5) > 0 ? busy : options;
    return pool[rng.nextInt(pool.length)]!;
  }
  if (level === "normal") {
    // The best-looking move one step ahead; now and then one of the next best instead.
    const ranked = rankActions(state, seat, options, rng, w);
    return rng.nextInt(SLIP_ONE_IN) === 0 ? ranked[rng.nextInt(Math.min(3, ranked.length))]! : ranked[0]!;
  }
  return planTurn(state, seat, rng, w) ?? rankActions(state, seat, options, rng, w)[0]!;
}

/**
 * How each level judges positions: its weights, leaning toward its current agenda.
 * `temperament`: how much its own leaning counts against what the board offers (Hard follows
 * the board more). `strength`: how hard it leans toward the agenda.
 */
const STYLE: Record<AiLevel, { base: Weights; temperament: number; strength: number }> = {
  easy: { base: CLASSIC, temperament: 0.8, strength: 1 },
  normal: { base: CLASSIC, temperament: 0.6, strength: 0.9 },
  hard: { base: CLASSIC, temperament: 0.45, strength: 0.45 },
};

/**
 * The agenda each seat of each game played for last, so it sticks with a plan until another is
 * clearly better (by `STICK`). Forgotten when the game goes back (Undo) or a new one starts.
 */
const lastAgenda = new Map<string, { agenda: AgendaId; drawn: number }>();
const STICK = 0.15;

/** The agenda `seat` plays for now, at this level. */
export function aiAgenda(state: GameState, seat: PlayerId, level: AiLevel): AgendaId {
  const key = [state.seed, seat, level, state.players[0].partyId, state.players[1].partyId, state.expansion ? "x" : ""].join("|");
  // The draw deck only shrinks during a game.
  const drawn = -state.deck.length;
  const held = lastAgenda.get(key);
  const agenda = chooseAgenda(state, seat, STYLE[level].temperament, held && held.drawn <= drawn ? held.agenda : null, STICK);
  lastAgenda.delete(key);
  lastAgenda.set(key, { agenda, drawn });
  if (lastAgenda.size > 32) lastAgenda.delete(lastAgenda.keys().next().value!);
  return agenda;
}

function weightsFor(state: GameState, seat: PlayerId, level: AiLevel): Weights {
  const style = STYLE[level];
  if (state.phase === "setup") return style.base;
  return focusWeights(style.base, aiAgenda(state, seat, level), style.strength);
}

/** Normal: how often it settles for one of its top three moves instead of the best. */
const SLIP_ONE_IN = 4;

/** Hard: partial turns kept at each step of its plan, and decisions looked ahead. */
const BEAM = 6;
const DEPTH = 8;
/** Hard: leading plans played on past the turn, and on how many guesses of the hidden cards. */
const CANDIDATES = 4;
const SAMPLES = 3;
/** Hard: how much the board after its next turn counts against the board after this one. */
const LOOKAHEAD = 0.75;
/** Hard: one guess's score is held within this, so no single lucky (or unlucky) guess decides. */
const CAP = 5000;

/**
 * Hard: plan the rest of this turn. Grow sequences of its own decisions (main action, free
 * actions, politics, income) step by step, keeping the most promising few, until the turn
 * passes or the game ends. Then play the leading plans on: the opponent's reply and its own
 * next turn, on a few guesses of the hidden cards (the draw deck, the opponent's hand), the
 * same guesses for every plan so luck doesn't pick between them. Plans the opponent wins
 * against sink; plans that set up its own win next turn rise. Play the first move of the best.
 */
function planTurn(state: GameState, seat: PlayerId, rng: Rng, w: Weights): Action | null {
  type Node = { state: GameState; actions: Action[]; score: number };
  let beam: Node[] = [{ state: withHiddenPilesShuffled(state, rng), actions: [], score: 0 }];
  const finished: Node[] = [];
  for (let depth = 0; depth < DEPTH && beam.length > 0; depth++) {
    const next: Node[] = [];
    for (const node of beam) {
      for (const action of aiOptions(node.state, seat)) {
        let child: GameState;
        try {
          child = apply(node.state, action, rng).state;
        } catch {
          continue;
        }
        const entry = { state: child, actions: [...node.actions, action], score: positionScore(child, seat, w) + rng.nextInt(1000) / 1e6 };
        // The turn is over (or the game): this sequence is done.
        if (child.victory || currentActor(child) !== seat) finished.push(entry);
        else next.push(entry);
      }
    }
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, BEAM);
  }
  finished.push(...beam);

  // The best plan for each first move, best first.
  const byFirst = new Map<string, Node>();
  for (const node of finished) {
    if (node.actions.length === 0) continue;
    const key = JSON.stringify(node.actions[0]);
    const held = byFirst.get(key);
    if (!held || node.score > held.score) byFirst.set(key, node);
  }
  const plans = [...byFirst.values()].sort((a, b) => b.score - a.score).slice(0, CANDIDATES);
  if (plans.length <= 1) return plans[0]?.actions[0] ?? null;

  // The same guesses for every plan: seeds drawn once.
  const seeds = Array.from({ length: SAMPLES }, () => rng.nextInt(2 ** 31));
  let best: { first: Action; value: number } | null = null;
  for (const plan of plans) {
    let value = plan.score;
    if (!plan.state.victory && currentActor(plan.state) !== seat) {
      let later = 0;
      for (const seed of seeds) {
        const guess = createSeededRng(seed);
        const after = ownTurnFrom(replyFrom(plan.state, seat, guess), seat, guess, w);
        later += Math.max(-CAP, Math.min(CAP, positionScore(after, seat, w))) / seeds.length;
      }
      value = (1 - LOOKAHEAD) * plan.score + LOOKAHEAD * later;
    }
    if (!best || value > best.value) best = { first: plan.actions[0]!, value };
  }
  return best!.first;
}

/** Its own next turn, each move the best-looking one step ahead. */
function ownTurnFrom(state: GameState, seat: PlayerId, rng: Rng, w: Weights): GameState {
  let current = state;
  for (let step = 0; step < 16 && !current.victory && currentActor(current) === seat; step++) {
    const options = aiOptions(current, seat);
    if (options.length === 0) break;
    const pick = options.find((action) => action.type === "declareVictory") ?? bestNext(current, seat, options, rng, w);
    try {
      current = apply(current, pick, rng).state;
    } catch {
      break;
    }
  }
  return current;
}

/**
 * The position after the opponent's turn, played as Normal would (the best move one step ahead
 * each time) from a guess at their hand.
 */
function replyFrom(state: GameState, seat: PlayerId, rng: Rng): GameState {
  let current = guessOpponentHand(state, seat, rng);
  for (let step = 0; step < 24 && !current.victory && currentActor(current) !== seat; step++) {
    const actor = currentActor(current);
    const options = aiOptions(current, actor);
    if (options.length === 0) break;
    const pick = options.find((action) => action.type === "declareVictory") ?? bestNext(current, actor, options, rng);
    try {
      current = apply(current, pick, rng).state;
    } catch {
      break;
    }
  }
  return current;
}

/** The best-looking move one step ahead, on a position that's already safe to try moves on. */
function bestNext(state: GameState, seat: PlayerId, options: readonly Action[], rng: Rng, w: Weights = CLASSIC): Action {
  let pick = options[0]!;
  let top = -Infinity;
  for (const action of options) {
    let score: number;
    try {
      score = positionScore(apply(state, action, rng).state, seat, w) + rng.nextInt(1000) / 1e6;
    } catch {
      continue;
    }
    if (score > top) [top, pick] = [score, action];
  }
  return pick;
}

/**
 * A copy where the opponent's face-down hand is dealt again from everything `seat` can't see
 * (their face-down cards and the draw deck). Cards they took from the Market stay: those are public.
 */
export function guessOpponentHand(state: GameState, seat: PlayerId, rng: Rng): GameState {
  const copy = withHiddenPilesShuffled(state, rng);
  const opponent = copy.players[otherPlayer(seat)];
  const hidden = opponent.hand.filter((card) => !card.faceUp);
  if (hidden.length === 0) return copy;
  const pool = [...hidden, ...copy.deck];
  shuffle(pool, rng);
  const dealt: typeof pool = [];
  const rest: typeof pool = [];
  // General Elections never stay in a hand.
  for (const card of pool) (dealt.length < hidden.length && getCard(card.cardId).kind !== CardKind.Election ? dealt : rest).push(card);
  opponent.hand = [...opponent.hand.filter((card) => card.faceUp), ...dealt];
  copy.deck = rest;
  return copy;
}

/** Options from best to worst, judged one step ahead (never empty when `options` isn't). */
function rankActions(state: GameState, seat: PlayerId, options: readonly Action[], rng: Rng, w: Weights): Action[] {
  const fair = withHiddenPilesShuffled(state, rng);
  const scored: { action: Action; score: number }[] = [];
  for (const action of options) {
    try {
      // A hair of noise so equal moves don't always resolve the same way.
      scored.push({ action, score: positionScore(apply(fair, action, rng).state, seat, w) + rng.nextInt(1000) / 1e6 });
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
