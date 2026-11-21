/**
 * Every lesson plays to its end through the real engine: each guided move is legal when
 * asked for, the opponent's scripted moves are legal when due, the free stretches can be
 * finished, and the numbers the coach quotes match the rules.
 */
import { DISTRICTS, District, type DistrictId } from "../cards/schema.ts";
import { allCards, invariantIssues } from "../game/diagnostics.ts";
import { lordsSymbols, tallyElection } from "../game/election.ts";
import { legalActions } from "../game/engine.ts";
import { playerDistrictInfluence } from "../game/influence.ts";
import { createSeededRng } from "../game/rng.ts";
import { convincedVotes, senateTotalVotes, senateVotesNeeded } from "../game/senate.ts";
import { assert, fail, report } from "../game/test-helpers.ts";
import { Phase, type GameState, type PlayerId } from "../game/types.ts";
import { relationLeads, supportCount } from "../game/world.ts";
import {
  acknowledge,
  allows,
  decider,
  getLesson,
  LEARNER,
  LESSONS,
  matches,
  OPPONENT,
  opponentMove,
  playOpponent,
  shownStep,
  startLesson,
  submit,
  type Expect,
  type Lesson,
  type LessonRun,
} from "./index.ts";

const influence = (state: GameState, player: PlayerId, district: DistrictId) =>
  playerDistrictInfluence(state, player, district).total;
const support = (state: GameState, player: PlayerId) =>
  DISTRICTS.reduce((sum, district) => sum + supportCount(state, player, district), 0);

/** What the coach says at a step, checked when the lesson reaches it. */
const CLAIMS: Record<string, Record<number, (state: GameState) => string | null>> = {
  "first-day": {
    5: (s) => (influence(s, 0, District.Shavvinne) === 9 ? null : "Roman Church gives 9 in Shavvinne"),
    8: (s) => (influence(s, 1, District.Horsard) === 5 ? null : "Mildred has 5 in Horsard"),
  },
  scandal: {
    0: (s) =>
      influence(s, 1, District.Horsard) === 14 && influence(s, 0, District.Horsard) === 3 ? null : "Horsard is 14 to 3",
    3: (s) =>
      influence(s, 1, District.Horsard) === 2 && influence(s, 0, District.Horsard) === 2 ? null : "Horsard is 2–2 after the wipe",
  },
  friends: {
    2: (s) =>
      influence(s, 0, District.Dragonara) === 13 && influence(s, 1, District.Dragonara) === 12 ? null : "Dragonara is 13 to 12",
    3: (s) => (lordsSymbols(s, 0) === 1 && lordsSymbols(s, 1) === 0 ? null : "Lords 1–0"),
    6: (s) => (lordsSymbols(s, 0) === 1 && lordsSymbols(s, 1) === 1 ? null : "Lords 1–1"),
  },
  rally: {
    3: (s) => (s.players[0].partisans === 3 && s.players[1].partisans === 0 ? null : "partisans 3–0"),
  },
  senate: {
    0: (s) => (senateTotalVotes(s) === 6 ? null : "the Senate holds 6 votes"),
    4: (s) =>
      influence(s, 0, District.Horsard) === 8 && influence(s, 1, District.Horsard) === 7 ? null : "Horsard is 8 to 7",
    6: (s) => (s.players[1].support.dragonara.some((card) => card.cardId === "dragonara-c-1") ? null : "Theft of Thunder went to Crane"),
  },
  law: {
    0: (s) => (senateTotalVotes(s) === 7 && senateVotesNeeded(s) === 4 ? null : "4 of 7 votes"),
    2: (s) => (convincedVotes(s, ["smarbbit-a-2", "shavvinne-b-2"]) === 4 ? null : "Capitol Inc. and TuWang Gang convince 4"),
    4: (s) =>
      influence(s, 0, District.Shavvinne) >= 26 && influence(s, 1, District.Shavvinne) === 13 ? null : "your Shavvinne civils doubled",
  },
  monuments: {
    2: (s) => (s.players[0].monuments.some((card) => card.cardId === "model-society") ? null : "you built Model Society"),
  },
  election: {
    1: (s) => (tallyElection(s).electorates.join() === "2,3" ? null : "electorates 2 to 3"),
    5: (s) => (s.players[0].electionWins === 1 ? null : "you won the election"),
  },
  political: {
    1: (s) => (support(s, 0) === 3 && support(s, 1) === 2 ? null : "support 3 to 2"),
    4: (s) =>
      s.players[0].partisans === 2 && s.players[1].partisans === 1 && support(s, 0) === 6 && support(s, 1) === 2
        ? null
        : "partisans 2–1 and support 6–2",
  },
  diplomacy: {
    5: (s) => (relationLeads(s, 0) === 3 ? null : "you lead 3 of 4 powers"),
  },
};

/** Lessons whose opponent script only runs if the learner fails. */
const SCRIPT_ON_FAILURE = new Set(["exam"]);

/**
 * Play a lesson to its end. Free stretches play `free` if given, else each free step's own
 * solution. Returns the finished run and the claims that were checked on the way.
 */
function playThrough(lesson: Lesson, free?: Expect[]): { run: LessonRun; checked: Set<number> } {
  const rng = createSeededRng(7);
  let run = startLesson(lesson);
  const problems = invariantIssues(run.state, null);
  assert(problems.length === 0, `${lesson.id}: the scenario is valid (${problems.join("; ")})`);
  const cardCount = allCards(run.state).length;
  const checked = new Set<number>();
  const override = free ? [...free] : null;
  let queue: Expect[] = [];
  let queueStep = -1;
  for (let guard = 0; guard < 200 && run.outcome === "playing"; guard++) {
    const step = shownStep(run);
    const claim = CLAIMS[lesson.id]?.[run.step];
    if (step && claim && !checked.has(run.step)) {
      checked.add(run.step);
      const problem = claim(run.state);
      if (problem) fail(`${lesson.id} step ${run.step} (${step.title}): expected ${problem}`);
    }
    if (!step) {
      const move = opponentMove(run, rng);
      if (!move) {
        fail(`${lesson.id}: stuck at step ${run.step} (decider ${decider(run.state)}, phase ${run.state.phase})`);
        break;
      }
      if (!move.scripted) fail(`${lesson.id}: the opponent ran out of script at step ${run.step} (${move.action.type})`);
      run = playOpponent(run, move, rng);
    } else if (step.kind === "explain") {
      run = acknowledge(run);
    } else {
      const label = `${lesson.id} step ${run.step} (${step.title})`;
      if (step.kind === "free" && queueStep !== run.step) {
        queue = override ?? [...step.solution];
        queueStep = run.step;
      }
      const expect = step.kind === "do" ? step.expect : queue.shift();
      if (!expect) {
        fail(`${label}: the free stretch's moves ran out`);
        break;
      }
      const action = legalActions(run.state, LEARNER).find((candidate) => matches(expect, candidate));
      if (!action) {
        fail(`${label}: no legal move matches ${JSON.stringify(expect)}`);
        break;
      }
      assert(allows(run, action), `${label}: the table offers ${action.type}`);
      const result = submit(run, action, rng);
      if ("hint" in result) {
        fail(`${label}: refused (${result.hint})`);
        break;
      }
      run = result.run;
    }
    const issues = invariantIssues(run.state, cardCount);
    if (issues.length > 0) {
      fail(`${lesson.id} step ${run.step}: ${issues.join("; ")}`);
      break;
    }
  }
  return { run, checked };
}

// --- Every lesson finishes ------------------------------------------------------------------
for (const lesson of LESSONS) {
  const { run, checked } = playThrough(lesson);
  assert(run.outcome === "complete", `${lesson.id}: the lesson completes (outcome ${run.outcome}, step ${run.step})`);
  if (!SCRIPT_ON_FAILURE.has(lesson.id)) {
    assert(run.script === lesson.script.length, `${lesson.id}: the opponent plays its whole script (${run.script}/${lesson.script.length})`);
  }
  for (const index of Object.keys(CLAIMS[lesson.id] ?? {})) {
    assert(checked.has(Number(index)), `${lesson.id}: the claim at step ${index} was checked`);
  }
  for (const step of lesson.steps) {
    assert(step.title.length > 0 && step.body.length > 0, `${lesson.id}: every step has a title and words`);
    assert(!step.target || !(lesson.dim ?? []).includes(step.target), `${lesson.id}: "${step.title}" points at a dimmed area`);
    if (step.target?.startsWith("lane:")) {
      assert((DISTRICTS as readonly string[]).includes(step.target.slice(5)), `${lesson.id}: ${step.target} is a district`);
    }
  }
}

// --- Ids are unique; base and expansion lessons are set up as such ---------------------------------------------
{
  const ids = LESSONS.map((lesson) => lesson.id);
  assert(new Set(ids).size === ids.length, "Lesson ids are unique");
  assert(getLesson("first-day")?.title === "First day at Town Hall", "getLesson finds a lesson by id");
  assert(LESSONS.filter((lesson) => lesson.expansion).every((lesson) => lesson.scenario.expansion), "Expansion lessons set up the expansion");
  assert(LESSONS.filter((lesson) => !lesson.expansion).every((lesson) => !lesson.scenario.expansion), "Base lessons stay base games");
}

// --- Guided steps only allow the move they teach -------------------------------------------
{
  const lesson = getLesson("first-day")!;
  let run = startLesson(lesson);
  // Explanations first: nothing is allowed while one is showing.
  assert(legalActions(run.state, LEARNER).every((action) => !allows(run, action)), "Nothing lights up during an explanation");
  const refused = submit(run, legalActions(run.state, LEARNER)[0]!, createSeededRng(1));
  assert("hint" in refused, "A move during an explanation is refused");
  while (shownStep(run)?.kind === "explain") run = acknowledge(run);
  const legal = legalActions(run.state, LEARNER);
  const allowed = legal.filter((action) => allows(run, action));
  assert(
    allowed.length === 1 && allowed[0]!.type === "playCivil" && allowed[0]!.instanceId === "shavvinne-b-1",
    "Only Roman Church can be played",
  );
  const other = legal.find((action) => action.type === "playCivil" && action.instanceId !== "shavvinne-b-1")!;
  const hint = submit(run, other, createSeededRng(1));
  assert("hint" in hint && hint.hint.includes("Roman Church"), "Another card gets the step's hint");
}

// --- The exam can be failed, and Vex says so ----------------------------------------------
{
  const exam = getLesson("exam")!;
  const { run } = playThrough(exam, [{ type: "playCivil", card: "horsard-b-6" }, { type: "endPolitics" }, { type: "takeMarket" }]);
  assert(run.outcome === "failed", `Passing up the win lets Vex win (outcome ${run.outcome})`);
  assert(run.state.victory?.player === OPPONENT && run.state.victory.kind === "military", "Vex declares Military Victory");
  assert(run.script === exam.script.length, "Vex plays his scripted turn");
}

// --- The opponent waits while a `now` step is showing ----------------------------------------
{
  const lesson = getLesson("election")!;
  let run = startLesson(lesson);
  const rng = createSeededRng(3);
  for (let guard = 0; guard < 50 && run.state.phase !== Phase.DecreeChoice; guard++) {
    const step = shownStep(run)!;
    if (step.kind === "explain") run = acknowledge(run);
    else if (step.kind === "do") {
      const action = legalActions(run.state, LEARNER).find((candidate) => matches(step.expect, candidate))!;
      const result = submit(run, action, rng);
      if ("run" in result) run = result.run;
    }
  }
  const decree = legalActions(run.state, LEARNER).find((action) => action.type === "activateDecree")!;
  const result = submit(run, decree, rng);
  assert("run" in result, "The winner activates a decree");
  if ("run" in result) {
    run = result.run;
    assert(decider(run.state) === OPPONENT, "Crane moves next");
    assert(shownStep(run)?.now === true, "The decrees note shows at once");
    assert(opponentMove(run, rng) === null, "Crane waits until the note is read");
    run = acknowledge(run);
    assert(run.outcome === "complete", "Reading it finishes the lesson");
  }
}

report(`Tutorial ok: ${LESSONS.length} lessons play through; guided steps, the exam's failure, and waiting notes.`);
