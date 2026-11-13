import { apply, currentActor } from "./engine.ts";
import { IllegalActionError } from "./errors.ts";
import { createSeededRng, type Rng } from "./rng.ts";
import { createGame } from "./setup.ts";
import { Phase, type Action, type GameEvent, type GameState } from "./types.ts";

/**
 * A game is fully described by its seed and its action list: the engine is
 * deterministic, so replaying the actions rebuilds every state exactly.
 */
export const RECORD_VERSION = 1;

export type GameRecord = {
  version: typeof RECORD_VERSION;
  seed: number;
  actions: Action[];
};

export type ReplayStep = {
  action: Action;
  events: GameEvent[];
  /** Whether this step can be taken back with Undo (see `undoBlockReason`). */
  undoable: boolean;
};

export type Replay = {
  seed: number;
  /** Seeded RNG positioned after the last step. Mutated by `step`. */
  rng: Rng;
  state: GameState;
  steps: ReplayStep[];
};

export class ReplayError extends Error {
  readonly index: number;
  readonly action: Action;

  constructor(index: number, action: Action, cause: unknown) {
    super(`Action ${index + 1} (${action.type}) failed to replay: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "ReplayError";
    this.index = index;
    this.action = action;
    this.cause = cause;
  }
}

export function newReplay(seed: number): Replay {
  const rng = createSeededRng(seed);
  return { seed, rng, state: createGame(rng, { seed }), steps: [] };
}

/** Apply one action. Throws `IllegalActionError` and leaves the replay unchanged if it is illegal. */
export function stepReplay(replay: Replay, action: Action): Replay {
  const before = replay.state;
  const result = apply(before, action, replay.rng);
  const undoable = undoBlockReason(before, action, result.events, result.state) === null;
  return {
    ...replay,
    state: result.state,
    steps: [...replay.steps, { action, events: result.events, undoable }],
  };
}

/** Rebuild a game from its record. Throws `ReplayError` naming the first action that fails. */
export function replayRecord(record: GameRecord): Replay {
  let replay = newReplay(record.seed);
  record.actions.forEach((action, index) => {
    try {
      replay = stepReplay(replay, action);
    } catch (error) {
      throw new ReplayError(index, action, error);
    }
  });
  return replay;
}

export function toRecord(replay: Replay): GameRecord {
  return { version: RECORD_VERSION, seed: replay.seed, actions: replay.steps.map((step) => step.action) };
}

/** Events that show a player something they could not see before the action. */
const REVEALING_EVENTS = new Set<GameEvent["type"]>([
  "cardDrawn",
  "marketReplenished",
  "monumentReplenished",
  "electionStarted",
  "electionSetAside",
  "partiesRevealed",
]);

/**
 * Undo is local hotseat help for misclicks, not a way to scout hidden cards or
 * take back a move after the device has been passed. An action can be undone
 * only when the same player is still acting afterwards and it revealed nothing.
 */
export function undoBlockReason(
  before: GameState,
  action: Action,
  events: readonly GameEvent[],
  after: GameState,
): string | null {
  if (before.phase === Phase.Setup) return "Setup choices can't be undone";
  if (after.victory) return "The game is over";
  if (currentActor(after) !== action.player) return "The turn has passed";
  if (action.type === "freeAction" && action.ability === "intelNetwork") {
    return "Intel Network revealed cards from the deck";
  }
  if (events.some((event) => REVEALING_EVENTS.has(event.type))) {
    return "That action revealed hidden cards";
  }
  return null;
}

/** Take back the last step by replaying everything before it. */
export function undoReplay(replay: Replay): Replay {
  const last = replay.steps.at(-1);
  if (!last) throw new IllegalActionError("Nothing to undo");
  if (!last.undoable) throw new IllegalActionError("The last action can't be undone");
  return replayRecord({
    version: RECORD_VERSION,
    seed: replay.seed,
    actions: replay.steps.slice(0, -1).map((step) => step.action),
  });
}

export function canUndo(replay: Replay): boolean {
  return replay.steps.at(-1)?.undoable ?? false;
}

/** Parse untrusted JSON into a record, or null if it isn't one. */
export function parseRecord(value: unknown): GameRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<GameRecord>;
  if (candidate.version !== RECORD_VERSION) return null;
  if (typeof candidate.seed !== "number" || !Number.isInteger(candidate.seed) || candidate.seed < 0) return null;
  if (!Array.isArray(candidate.actions)) return null;
  if (!candidate.actions.every((action) => action && typeof action === "object" && typeof action.type === "string")) {
    return null;
  }
  return { version: RECORD_VERSION, seed: candidate.seed >>> 0, actions: candidate.actions as Action[] };
}
