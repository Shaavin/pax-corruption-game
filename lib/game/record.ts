import { hasNames, parseNames, type PlayerNames } from "./names.ts";
import { apply, currentActor } from "./engine.ts";
import { IllegalActionError } from "./errors.ts";
import { createSeededRng, type Rng } from "./rng.ts";
import { createGame, isGameMode } from "./setup.ts";
import { GameMode, Phase, type Action, type GameEvent, type GameModeId, type GameState } from "./types.ts";

/**
 * A game is fully described by its seed and its action list: the engine is
 * deterministic, so replaying the actions rebuilds every state exactly.
 */
export const RECORD_VERSION = 1;

/**
 * Bump whenever a rules or engine change can make an old action list replay
 * differently. Records carry it so troubleshooting can flag a mismatch.
 */
export const ENGINE_VERSION = "2026-11-13.2";

export type GameRecord = {
  version: typeof RECORD_VERSION;
  seed: number;
  /** Draw-deck mode. Absent means Standard (records from before modes existed). */
  mode?: GameModeId;
  /** Legacy & Diplomacy expansion. Absent means the base game. */
  expansion?: boolean;
  /** Expansion Foreign Influence variant. */
  foreignInfluence?: boolean;
  actions: Action[];
  /** `ENGINE_VERSION` of the build that recorded the game. */
  engineVersion?: string;
  /** App build (git commit) that recorded the game, when known. */
  build?: string;
  /** Optional player names (display only). */
  names?: PlayerNames;
};

/** What a player sends when something went wrong. */
export type BugReport = {
  kind: "pax-bug-report";
  record: GameRecord;
  /** Number of actions taken when the report was made. */
  stepCount: number;
  /** Seat that was looking at the table, if any. */
  viewer: number | null;
  description: string;
  createdAt: string;
  userAgent?: string;
};

export type ReplayStep = {
  action: Action;
  events: GameEvent[];
  /** Whether this step can be taken back with Undo (see `undoBlockReason`). */
  undoable: boolean;
  /** Why not, when it can't. */
  undoBlock?: string;
};

/** Everything besides the seed that decides how a game is set up. */
export type GameSetupOptions = { mode?: GameModeId; expansion?: boolean; foreignInfluence?: boolean };

export type Replay = {
  seed: number;
  mode: GameModeId;
  expansion: boolean;
  foreignInfluence: boolean;
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

export function newReplay(seed: number, options: GameModeId | GameSetupOptions = {}): Replay {
  const opts = typeof options === "string" ? { mode: options } : options;
  const mode = opts.mode ?? GameMode.Standard;
  const expansion = Boolean(opts.expansion);
  const foreignInfluence = expansion && Boolean(opts.foreignInfluence);
  const rng = createSeededRng(seed);
  return {
    seed,
    mode,
    expansion,
    foreignInfluence,
    rng,
    state: createGame(rng, { seed, mode, expansion, foreignInfluence }),
    steps: [],
  };
}

function setupOf(record: GameRecord): GameSetupOptions {
  return { mode: record.mode, expansion: record.expansion, foreignInfluence: record.foreignInfluence };
}

/** Apply one action. Throws `IllegalActionError` and leaves the replay unchanged if it is illegal. */
export function stepReplay(replay: Replay, action: Action): Replay {
  const before = replay.state;
  const result = apply(before, action, replay.rng);
  const undoBlock = undoBlockReason(before, action, result.events, result.state);
  return {
    ...replay,
    state: result.state,
    steps: [
      ...replay.steps,
      { action, events: result.events, undoable: undoBlock === null, ...(undoBlock ? { undoBlock } : {}) },
    ],
  };
}

/** Rebuild a game from its record. Throws `ReplayError` naming the first action that fails. */
export function replayRecord(record: GameRecord): Replay {
  let replay = newReplay(record.seed, setupOf(record));
  record.actions.forEach((action, index) => {
    try {
      replay = stepReplay(replay, action);
    } catch (error) {
      throw new ReplayError(index, action, error);
    }
  });
  return replay;
}

export function toRecord(replay: Replay, build?: string, names?: PlayerNames): GameRecord {
  return {
    version: RECORD_VERSION,
    seed: replay.seed,
    ...(replay.mode !== GameMode.Standard ? { mode: replay.mode } : {}),
    ...(replay.expansion ? { expansion: true } : {}),
    ...(replay.foreignInfluence ? { foreignInfluence: true } : {}),
    actions: replay.steps.map((step) => step.action),
    engineVersion: ENGINE_VERSION,
    ...(build ? { build } : {}),
    ...(hasNames(names) ? { names: [names[0], names[1]] as const } : {}),
  };
}

/** Events that show a player something they could not see before the action. */
const REVEALING_EVENTS = new Set<GameEvent["type"]>([
  "cardDrawn",
  "marketReplenished",
  "monumentReplenished",
  "electionStarted",
  "electionSetAside",
  "partiesRevealed",
  // Expansion: a new event flipped from the event deck.
  "eventRevealed",
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
    mode: replay.mode,
    expansion: replay.expansion,
    foreignInfluence: replay.foreignInfluence,
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
  if (candidate.mode !== undefined && !isGameMode(candidate.mode)) return null;
  if (!candidate.actions.every((action) => action && typeof action === "object" && typeof action.type === "string")) {
    return null;
  }
  return {
    version: RECORD_VERSION,
    seed: candidate.seed >>> 0,
    ...(candidate.mode && candidate.mode !== GameMode.Standard ? { mode: candidate.mode } : {}),
    ...(candidate.expansion === true ? { expansion: true } : {}),
    ...(candidate.expansion === true && candidate.foreignInfluence === true ? { foreignInfluence: true } : {}),
    actions: candidate.actions as Action[],
    ...(typeof candidate.engineVersion === "string" ? { engineVersion: candidate.engineVersion } : {}),
    ...(typeof candidate.build === "string" ? { build: candidate.build } : {}),
    ...(hasNames(parseNames(candidate.names)) ? { names: parseNames(candidate.names) } : {}),
  };
}

export function parseBugReport(value: unknown): BugReport | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<BugReport>;
  if (candidate.kind !== "pax-bug-report") return null;
  const record = parseRecord(candidate.record);
  if (!record) return null;
  const stepCount = Number(candidate.stepCount);
  return {
    kind: "pax-bug-report",
    record,
    stepCount: Number.isInteger(stepCount) && stepCount >= 0 ? Math.min(stepCount, record.actions.length) : record.actions.length,
    viewer: candidate.viewer === 0 || candidate.viewer === 1 ? candidate.viewer : null,
    description: typeof candidate.description === "string" ? candidate.description : "",
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
    ...(typeof candidate.userAgent === "string" ? { userAgent: candidate.userAgent } : {}),
  };
}

const CODE_PREFIX = "PAX1:";

/** A copy-and-paste code for a record or report: `PAX1:` + base64url JSON. */
export function encodeShareCode(value: GameRecord | BugReport): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return CODE_PREFIX + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Read anything a player might paste or upload: a share code, a record's
 * JSON, or a bug report's JSON. Returns null if it is none of those.
 */
export function parseImport(text: string): { record: GameRecord; report: BugReport | null } | null {
  const trimmed = text.trim();
  let value: unknown;
  try {
    if (trimmed.startsWith(CODE_PREFIX)) {
      const base64 = trimmed.slice(CODE_PREFIX.length).replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
      const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
      value = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0))));
    } else {
      value = JSON.parse(trimmed);
    }
  } catch {
    return null;
  }
  const report = parseBugReport(value);
  if (report) return { record: report.record, report };
  const record = parseRecord(value);
  return record ? { record, report: null } : null;
}
