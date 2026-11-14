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
import { cleanName, nameProblem, playerName } from "./names.ts";
import { isProfane } from "./profanity.ts";
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

{
  // Player names: cleaned, optional, carried by records, ignored by the engine.
  assert(cleanName("  Ann " + String.fromCharCode(10) + "  Lee" + String.fromCharCode(7) + " ") === "Ann Lee", "Names collapse whitespace and drop control characters");
  assert(cleanName("   ") === null && cleanName(42) === null, "Blank or non-string names are no name");
  assert(cleanName("x".repeat(50))!.length === 20, "Names are capped at 20 characters");
  assert(playerName([null, "Bo"], 0) === "Player 1" && playerName([null, "Bo"], 1) === "Bo", "Unnamed seats fall back");
  const named = toRecord(newReplay(5, {}), undefined, ["Ann", null]);
  const parsed = parseRecord(JSON.parse(JSON.stringify(named)));
  assert(parsed?.names?.[0] === "Ann" && parsed.names[1] === null, "Names survive a JSON round trip");
  assert(!("names" in toRecord(newReplay(5, {}), undefined, [null, null])), "No names, no field");
  const hostile = parseRecord({ ...named, names: ["<b>" + "y".repeat(40), 7] });
  assert(hostile?.names?.[0]?.length === 20 && hostile.names[1] === null, "Imported names are cleaned");
  // Profanity, including look-alike spellings, is not a name; ordinary names that contain a blocked word are.
  for (const name of ["fuck", "f.u.c.k", "fvck", "sh1t", "$hit", "b!tch", "a$$", "@ss", "a s s", "c0ck", "n1gg3r", "Mr Dick", "dumbass", "FUmomCK", "biatch"]) {
    assert(isProfane(name), `Blocks ${name}`);
  }
  for (const name of ["Ann", "Cassandra", "Dickens", "Scunthorpe", "Hancock", "Classic", "Essex", "Titan", "Therapist", "Fukuda", "Peacock", "Assassin", "Joe Zhao", "Whitmore", "Shanita", "Fullback", "Bianca", "Cunningham"]) {
    assert(!isProfane(name), `Allows ${name}`);
  }
  assert(cleanName("sh1thead") === null, "A profane name is no name");
  assert(nameProblem("b1tch") !== null && nameProblem("Ann") === null && nameProblem("") === null, "Forms explain a blocked name");
  assert(parseRecord({ ...named, names: ["Ann", "a$$hole"] })?.names?.[1] === null, "Imported profane names are dropped");
}

report("Record ok: deterministic replay, JSON round trip, ReplayError index, undo rules, player names.");
