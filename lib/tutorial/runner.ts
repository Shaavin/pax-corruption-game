/**
 * Playing a lesson: the engine runs the game; this keeps the coach's place in the steps,
 * decides which of the learner's moves the current step allows, and picks the opponent's
 * moves from their script (then from the computer opponent). Pure, so the lesson tests
 * and the table use the same rules.
 */
import { chooseAiAction } from "../game/ai.ts";
import { apply, currentActor, legalActions } from "../game/engine.ts";
import { newReplay } from "../game/record.ts";
import type { Rng } from "../game/rng.ts";
import { Phase, type Action, type GameEvent, type GameState, type PlayerId } from "../game/types.ts";
import { CAST } from "./cast.ts";
import { isNewGame, matches, type Lesson, type LessonStep } from "./lesson.ts";
import { buildScenario } from "./scenario.ts";

/** The learner always plays seat 0; the opponent seat 1. */
export const LEARNER: PlayerId = 0;
export const OPPONENT: PlayerId = 1;

export type LessonOutcome = "playing" | "complete" | "failed";

export type LessonRun = {
  lesson: Lesson;
  state: GameState;
  /** Index of the current step; `steps.length` once every step is done. */
  step: number;
  /** Next entry of the opponent's script. */
  script: number;
  history: GameEvent[];
  /** The learner's turns that have ended so far. */
  turnsEnded: number;
  /** `turnsEnded` when the current free step began. */
  freeFrom: number;
  outcome: LessonOutcome;
};

/** A lesson's seed: its table's, or for a whole game the one the attempt was dealt with. */
export function lessonSeed(lesson: Lesson, dealt?: number): number {
  return isNewGame(lesson.scenario) ? (dealt ?? 1) : lesson.scenario.seed;
}

/** A prepared table, or (for a whole game) a new standard base game dealt with `seed`. */
export function startLesson(lesson: Lesson, seed?: number): LessonRun {
  const state = isNewGame(lesson.scenario) ? newReplay(lessonSeed(lesson, seed)).state : buildScenario(lesson.scenario);
  return {
    lesson,
    state,
    step: 0,
    script: 0,
    history: [],
    turnsEnded: 0,
    freeFrom: 0,
    outcome: "playing",
  };
}

/** Who has to decide something now (the election winner while decrees are chosen). */
export function decider(state: GameState): PlayerId {
  if (state.phase === Phase.DecreeChoice && state.pendingDecrees) return state.pendingDecrees.player;
  return currentActor(state);
}

/**
 * The step the coach shows now, or null: a step waits for the learner's next decision
 * unless it's marked `now`, so the opponent's turn plays out first.
 */
export function shownStep(run: LessonRun): LessonStep | null {
  if (run.outcome !== "playing") return null;
  const step = run.lesson.steps[run.step];
  if (!step) return null;
  if (step.now || run.state.victory) return step;
  return decider(run.state) === LEARNER ? step : null;
}

/** May the learner make this move now? (Drives what lights up on the table.) */
export function allows(run: LessonRun, action: Action): boolean {
  const step = shownStep(run);
  if (!step || action.player !== LEARNER || decider(run.state) !== LEARNER) return false;
  if (step.kind === "explain") return false;
  if (step.kind === "do") return matches(step.expect, action);
  return true;
}

export type Submitted = { run: LessonRun } | { hint: string };

/** The learner's move: applied if the step allows it, otherwise the step's hint. */
export function submit(run: LessonRun, action: Action, rng: Rng): Submitted {
  const step = shownStep(run);
  if (!step) return { hint: "Wait a moment: it isn't your move yet." };
  if (step.kind === "explain") return { hint: "Read the note, then press Next." };
  if (step.kind === "do" && !matches(step.expect, action)) return { hint: step.hint };
  const next = play(run, action, rng);
  if (step.kind === "do") return { run: settle(advance(next)) };
  return { run: settle(next) };
}

/** The learner pressed Next on an explanation. */
export function acknowledge(run: LessonRun): LessonRun {
  const step = shownStep(run);
  if (!step || step.kind !== "explain") return run;
  return settle(advance(run));
}

/** The opponent's next move, if it's theirs to make, and what they say with it. */
export function opponentMove(run: LessonRun, rng: Rng): { action: Action; say?: string; scripted: boolean } | null {
  if (run.outcome !== "playing" || run.state.victory || decider(run.state) !== OPPONENT) return null;
  // A step marked `now` holds the opponent until the learner has read it.
  if (run.lesson.steps[run.step]?.now) return null;
  const legal = legalActions(run.state, OPPONENT);
  if (legal.length === 0) return null;
  const entry = run.lesson.script[run.script];
  if (entry) {
    const action = legal.find((candidate) => matches(entry, candidate));
    if (action) return { action, say: entry.say, scripted: true };
  }
  const level = run.lesson.opponentLevel ?? CAST[run.lesson.opponent].level;
  return { action: chooseAiAction(run.state, OPPONENT, level, rng) ?? legal[0]!, scripted: false };
}

/** Make the opponent's move (from `opponentMove`). */
export function playOpponent(run: LessonRun, move: { action: Action; scripted: boolean }, rng: Rng): LessonRun {
  const next = play(run, move.action, rng);
  return settle(move.scripted ? { ...next, script: next.script + 1 } : next);
}

function play(run: LessonRun, action: Action, rng: Rng): LessonRun {
  let result = apply(run.state, action, rng);
  let events = result.events;
  // Lessons without politics pass the step for whoever reaches it.
  while (run.lesson.skipPolitics && result.state.phase === Phase.Politics && !result.state.victory) {
    result = apply(result.state, { type: "endPolitics", player: currentActor(result.state) }, rng);
    events = [...events, ...result.events];
  }
  const ended = events.filter((event) => event.type === "turnEnded" && event.nextPlayer === OPPONENT).length;
  return { ...run, state: result.state, history: [...run.history, ...events], turnsEnded: run.turnsEnded + ended };
}

function advance(run: LessonRun): LessonRun {
  return { ...run, step: run.step + 1, freeFrom: run.turnsEnded };
}

/** After any move: free steps that are done move on; a win or the last step ends the lesson. */
function settle(run: LessonRun): LessonRun {
  let next = run;
  const victory = next.state.victory;
  if (victory) {
    return { ...next, outcome: victory.player === LEARNER ? "complete" : "failed" };
  }
  const step = next.lesson.steps[next.step];
  if (step?.kind === "free" && step.until === "turnEnd" && next.turnsEnded > next.freeFrom) next = advance(next);
  if (next.step >= next.lesson.steps.length) return { ...next, outcome: "complete" };
  return next;
}
