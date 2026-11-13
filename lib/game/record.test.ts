import { currentActor, legalActions } from "./engine.ts";
import {
  canUndo,
  newReplay,
  parseRecord,
  replayRecord,
  ReplayError,
  stepReplay,
  toRecord,
  undoReplay,
  type Replay,
} from "./record.ts";
import { createSeededRng } from "./rng.ts";
import { assert, expectIllegal, fail, report } from "./test-helpers.ts";

/** Drive a game with arbitrary legal actions, picked by a separate seeded chooser. */
function autoplay(seed: number, steps: number): Replay {
  const chooser = createSeededRng(seed * 7 + 1);
  let replay = newReplay(seed);
  for (let i = 0; i < steps && !replay.state.victory; i++) {
    const options = legalActions(replay.state, currentActor(replay.state));
    if (options.length === 0) break;
    // Prefer anything but ending a step early, so games actually progress.
    const busy = options.filter((action) => action.type !== "endAction" && action.type !== "endPolitics");
    const pool = busy.length > 0 && chooser.nextInt(4) > 0 ? busy : options;
    replay = stepReplay(replay, pool[chooser.nextInt(pool.length)]!);
  }
  return replay;
}

// Replaying a record rebuilds the exact same state.
for (const seed of [3, 11, 42]) {
  const played = autoplay(seed, 250);
  assert(played.steps.length > 30, `Seed ${seed}: autoplay should get going`);
  const rebuilt = replayRecord(toRecord(played));
  assert(
    JSON.stringify(rebuilt.state) === JSON.stringify(played.state),
    `Seed ${seed}: replay reproduces the final state`,
  );
  // The RNG is positioned identically too: the next random draw matches.
  assert(rebuilt.rng.nextInt(1_000_000) === played.rng.nextInt(1_000_000), `Seed ${seed}: replay RNG in sync`);
}

// Records survive a JSON round trip; junk is rejected.
{
  const played = autoplay(5, 80);
  const parsed = parseRecord(JSON.parse(JSON.stringify(toRecord(played))));
  assert(parsed && parsed.actions.length === played.steps.length, "Record round-trips through JSON");
  assert(parseRecord(null) === null, "null is not a record");
  assert(parseRecord({ version: 99, seed: 1, actions: [] }) === null, "Unknown version is rejected");
  assert(parseRecord({ version: 1, seed: -4, actions: [] }) === null, "Negative seed is rejected");
  assert(parseRecord({ version: 1, seed: 1, actions: [3] }) === null, "Non-action entries are rejected");
}

// A broken record names the failing action.
{
  const played = autoplay(9, 60);
  const record = toRecord(played);
  const bad = { ...record, actions: [...record.actions.slice(0, 20), { type: "recruit", player: 0, instanceIds: ["nope"] } as never] };
  try {
    replayRecord(bad);
    fail("A broken record should not replay");
  } catch (error) {
    assert(error instanceof ReplayError && error.index === 20, `ReplayError points at action 21, got ${error}`);
  }
}

// Undo: setup is never undoable; undo restores the state before the action.
{
  const played = autoplay(13, 400);
  let setupUndoable = 0;
  let undone = 0;
  let blockedByTurn = 0;
  for (let i = 0; i < played.steps.length; i++) {
    const step = played.steps[i]!;
    const prefix = { ...toRecord(played), actions: toRecord(played).actions.slice(0, i + 1) };
    const at = replayRecord(prefix);
    if (step.action.type === "chooseParty" || step.action.type === "chooseStartingHand") {
      if (step.undoable) setupUndoable++;
      continue;
    }
    if (!step.undoable) {
      if (currentActor(at.state) !== step.action.player) blockedByTurn++;
      continue;
    }
    // Undoable: the same player still acts, and undo rebuilds the previous state.
    assert(currentActor(at.state) === step.action.player, "Undoable steps keep the same actor");
    assert(
      !step.events.some((event) => event.type === "cardDrawn" || event.type === "marketReplenished"),
      "Undoable steps reveal no hidden cards",
    );
    const before = replayRecord({ ...prefix, actions: prefix.actions.slice(0, -1) });
    const back = undoReplay(at);
    assert(JSON.stringify(back.state) === JSON.stringify(before.state), `Undo of step ${i + 1} restores the state`);
    undone++;
  }
  assert(setupUndoable === 0, "Setup actions are never undoable");
  assert(undone > 5, `Some steps are undoable (got ${undone})`);
  assert(blockedByTurn > 5, `Turn handoffs block undo (got ${blockedByTurn})`);
}

// Nothing to undo at the start; a handoff step can't be undone.
{
  const start = newReplay(1);
  assert(!canUndo(start), "Nothing to undo at the start");
  expectIllegal(() => undoReplay(start), "Undo with no steps");
  let replay = autoplay(21, 120);
  while (replay.steps.length > 0 && replay.steps.at(-1)!.undoable) replay = undoReplay(replay);
  if (replay.steps.length > 0) expectIllegal(() => undoReplay(replay), "Undo past a blocked step");
}

report("Record ok: deterministic replay, JSON round trip, ReplayError index, undo rules.");
