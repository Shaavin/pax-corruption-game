import { allCards, describeAction, invariantIssues, simulate } from "./diagnostics.ts";
import { currentActor, legalActions } from "./engine.ts";
import {
  encodeShareCode,
  ENGINE_VERSION,
  newReplay,
  parseImport,
  replayRecord,
  stepReplay,
  toRecord,
  type BugReport,
  type Replay,
} from "./record.ts";
import { createSeededRng } from "./rng.ts";
import { assert, report } from "./test-helpers.ts";

function autoplay(seed: number, steps: number): Replay {
  const chooser = createSeededRng(seed * 13 + 5);
  let replay = newReplay(seed);
  for (let i = 0; i < steps && !replay.state.victory; i++) {
    const options = legalActions(replay.state, currentActor(replay.state));
    if (options.length === 0) break;
    const busy = options.filter((action) => action.type !== "endAction" && action.type !== "endPolitics");
    const pool = busy.length > 0 && chooser.nextInt(4) > 0 ? busy : options;
    replay = stepReplay(replay, pool[chooser.nextInt(pool.length)]!);
  }
  return replay;
}

// A healthy game simulates cleanly, keeping every intermediate state.
for (const seed of [2, 17, 64]) {
  const played = autoplay(seed, 400);
  const sim = simulate(toRecord(played));
  assert(sim.failure === null, `Seed ${seed}: no failure, got ${sim.failure?.message}`);
  assert(sim.issues.length === 0, `Seed ${seed}: no invariant issues, got ${JSON.stringify(sim.issues[0])}`);
  assert(sim.states.length === played.steps.length + 1, `Seed ${seed}: one state per action plus the start`);
  assert(JSON.stringify(sim.states.at(-1)) === JSON.stringify(played.state), `Seed ${seed}: last state matches`);
  assert(sim.versionWarning === null, `Seed ${seed}: same engine version, no warning`);
}

// A bad action stops the simulation and names the step; earlier states are kept.
{
  const record = toRecord(autoplay(4, 60));
  record.actions.splice(30, 0, { type: "endPolitics", player: 0 });
  record.actions.splice(30, 0, { type: "endPolitics", player: 1 });
  const sim = simulate(record);
  assert(sim.failure !== null && sim.failure.index <= 31, `Failure reported at the inserted action, got ${sim.failure?.index}`);
  assert(sim.states.length === sim.failure.index + 1, "States stop at the failure");
}

// Invariants: a lost card and a duplicated card are both caught.
{
  const state = replayRecord(toRecord(autoplay(8, 40))).state;
  const baseline = allCards(state).length;
  assert(invariantIssues(state, baseline).length === 0, "Healthy state has no issues");
  const lost = structuredClone(state);
  lost.deck.pop();
  assert(invariantIssues(lost, baseline).some((issue) => issue.includes("Card count")), "A lost card is reported");
  const doubled = structuredClone(state);
  doubled.market.push(structuredClone(doubled.deck[0]!));
  assert(invariantIssues(doubled, baseline + 1).some((issue) => issue.includes("two places")), "A duplicated card is reported");
  const shortSenate = structuredClone(state);
  shortSenate.deck.push(shortSenate.senate.pop()!);
  assert(invariantIssues(shortSenate, baseline).some((issue) => issue.includes("Senate")), "A short Senate is reported");
}

// Version stamps.
{
  const record = toRecord(autoplay(6, 20));
  assert(record.engineVersion === ENGINE_VERSION, "Records carry the engine version");
  assert(simulate({ ...record, engineVersion: "1999-01-01" }).versionWarning?.includes("1999-01-01"), "Old version is flagged");
  const { engineVersion: _drop, ...unstamped } = record;
  void _drop;
  assert(simulate(unstamped).versionWarning !== null, "Missing version is flagged");
}

// Share codes and imports.
{
  const record = toRecord(autoplay(10, 50), "abc1234");
  const bug: BugReport = {
    kind: "pax-bug-report",
    record,
    stepCount: 40,
    viewer: 1,
    description: "Konnte nicht bauen — État ✓",
    createdAt: "2026-11-13T00:00:00.000Z",
  };
  const fromCode = parseImport(encodeShareCode(bug));
  assert(fromCode?.report?.description === bug.description, "Bug report survives a share code, unicode included");
  assert(fromCode?.record.build === "abc1234" && fromCode.record.actions.length === record.actions.length, "Record inside the report is intact");
  const fromJson = parseImport(JSON.stringify(record));
  assert(fromJson !== null && fromJson.report === null && fromJson.record.seed === record.seed, "Plain record JSON imports");
  assert(parseImport(`  ${encodeShareCode(record)}\n`)?.record.seed === record.seed, "Codes tolerate surrounding whitespace");
  assert(parseImport("PAX1:!!!") === null, "Garbage code is rejected");
  assert(parseImport("{}") === null, "Empty object is rejected");
  assert(parseImport("not json") === null, "Plain text is rejected");
}

// Descriptions name the cards involved.
{
  const sim = simulate(toRecord(autoplay(12, 30)));
  const index = sim.steps.findIndex((step) => step.action.type === "playCivil");
  if (index >= 0) {
    const text = describeAction(sim.steps[index]!.action, sim.states[index]!);
    assert(/^P[12] · Play civil — [A-Z][^;]*$/.test(text), `Civil play reads as a card name, got "${text}"`);
  }
}

report("Diagnostics ok: simulate, failure index, invariants, version stamps, share codes, action descriptions.");
