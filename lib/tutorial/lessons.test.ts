/**
 * Every lesson plays to its end through the real engine: each guided move is legal when
 * asked for, the opponent's scripted moves are legal when due, the free stretches can be
 * finished, and the numbers the coach quotes match the rules.
 */
import { DISTRICTS, District, MonumentId, type DistrictId } from "../cards/schema.ts";
import { chooseAiAction } from "../game/ai.ts";
import { allCards, invariantIssues } from "../game/diagnostics.ts";
import { isFinalElection, lordsSymbols, tallyElection } from "../game/election.ts";
import { legalActions } from "../game/engine.ts";
import { monumentCost } from "../game/monuments.ts";
import { playerDistrictInfluence } from "../game/influence.ts";
import { createSeededRng } from "../game/rng.ts";
import { convincedVotes, senateTotalVotes, senateVotesNeeded } from "../game/senate.ts";
import { assert, fail, report } from "../game/test-helpers.ts";
import { Phase, type Action, type GameState, type PlayerId } from "../game/types.ts";
import { declarableVictories, ideologicalSymbol, totalSymbols } from "../game/victory.ts";
import { relationLeads, supportCount } from "../game/world.ts";
import {
  acknowledge,
  allows,
  decider,
  getLesson,
  isNewGame,
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
    6: (s) => (s.players[0].hand.length === 4 ? null : "you hold 4 before income"),
    7: (s) =>
      s.players[0].hand.length === 5 && s.players[1].tableau.horsard.some((card) => card.cardId === "horsard-a-2")
        ? null
        : "you're at 5 (no draw) and Mildred played her Knights",
    8: (s) => (lordsSymbols(s, 0) === 0 && lordsSymbols(s, 1) === 1 ? null : "Lords: Mildred 1, you 0"),
    10: (s) =>
      influence(s, 0, District.Dragonara) === 15 &&
      influence(s, 1, District.Dragonara) === 12 &&
      lordsSymbols(s, 0) === 1 &&
      lordsSymbols(s, 1) === 1
        ? null
        : "Dragonara 15 to 12, Lords 1–1",
    11: (s) => (s.players[0].hand.length === 4 ? null : "you hold 4 before income"),
    12: (s) => (tallyElection(s).electorates.join() === "2,0" ? null : "electorates 2 to 0"),
  },
  doorstep: {
    0: (s) => (isFinalElection(s) && s.election.active && s.market.length === 3 ? null : "the final election, 3 Market cards left"),
    1: (s) =>
      tallyElection(s).electorates.join() === "1,2" &&
      influence(s, 0, District.Horsard) === 4 &&
      influence(s, 1, District.Horsard) === 14
        ? null
        : "electorates 1 to 2, Horsard 14 to 4",
    3: (s) => {
      const tally = tallyElection(s);
      return tally.electorates.join() === "2,2" && tally.electors.join() === "3,4" && tally.winner === 1
        ? null
        : "electorates 2–2, Mildred's districts hold 4 civil cards to your 3";
    },
    6: (s) =>
      influence(s, 0, District.Horsard) === 3 && influence(s, 1, District.Horsard) === 2 ? null : "Horsard 3 to 2 after the wipe",
    7: (s) => (tallyElection(s).electorates.join() === "3,1" && s.market.length === 1 ? null : "3 electorates to 1, one card left"),
  },
  legislative: {
    1: (s) => (senateTotalVotes(s) === 7 && senateVotesNeeded(s) === 4 ? null : "4 of 7 votes"),
    3: (s) => (convincedVotes(s, ["horsard-a-1", "shavvinne-b-2"]) === 4 ? null : "Order of Knights and TuWang Gang convince 4"),
    6: (s) => {
      const totals = totalSymbols(s);
      return totals.chart === 3 && totals.crown < 3 && totals.atom < 3 && totals.scales < 3 ? null : "3 Economy symbols, the most of any";
    },
    7: (s) => (ideologicalSymbol(s, 0) === null ? null : "Ideological Victory is out of reach"),
    9: (s) => (s.players[1].support.dragonara.some((card) => card.cardId === "dragonara-c-2") ? null : "Broken Chains went to Crane"),
    11: (s) =>
      influence(s, 0, District.Horsard) - supportCount(s, 0, District.Horsard) === 8 ? null : "Urban Planners counts 8 in Horsard",
    12: (s) => (s.players[0].support.horsard.some((card) => card.cardId === "horsard-a-6") ? null : "Financial Bankers joined your pile"),
  },
  executive: {
    0: (s) =>
      s.election.active && s.election.generalElections === 2 && s.market.length === 1 ? null : "2 General Elections, 1 card left",
    1: (s) =>
      tallyElection(s).electorates.join() === "2,3" &&
      influence(s, 0, District.Smarbbit) === 6 &&
      influence(s, 1, District.Smarbbit) === 9
        ? null
        : "electorates 2 to 3, Smarbbit 6 to 9",
    3: (s) => (influence(s, 0, District.Smarbbit) === 11 ? null : "Smarbbit 11 to 9"),
    5: (s) =>
      s.players[0].electionWins === 1 && s.players[0].partisans === 1 && s.players[1].partisans === 0
        ? null
        : "you won; partisans 1–0",
    6: (s) => (support(s, 0) === 6 && support(s, 1) === 1 ? null : "support 6 to 1"),
    7: (s) => {
      const kinds = declarableVictories(s, 0).map((victory) => victory.kind);
      return kinds.includes("political") && kinds.includes("ideological") ? null : "Political and Ideological in reach";
    },
  },
  untold: {
    0: (s) => (s.players[0].partisans === 1 && s.players[1].partisans === 0 ? null : "partisans 1–0"),
    3: (s) => (s.players[0].partisans === 2 ? null : "partisans 2–0 after Rebel Inc."),
    5: (s) =>
      supportCount(s, 0, District.Smarbbit) === 6 &&
      supportCount(s, 1, District.Smarbbit) === 0 &&
      s.players[0].monuments.some((card) => card.cardId === "model-society")
        ? null
        : "Model Society built; Smarbbit support 6 to 0",
    8: (s) =>
      monumentCost(s, MonumentId.DragonGate) === 4 && s.funding[MonumentId.DragonGate]?.[0]?.cardId === "dragonara-b-9"
        ? null
        : "Vex funded Dragon Gate with Fire Breathers: it costs 4",
    10: (s) => {
      const kinds = declarableVictories(s, 0).map((victory) => victory.kind);
      return s.players[0].partisans === 3 &&
        supportCount(s, 0, District.Smarbbit) === 9 &&
        kinds.includes("military") &&
        kinds.includes("popularity")
        ? null
        : "partisans 3–0, Smarbbit support 9–0, both victories ready";
    },
  },
  future: {
    6: (s) => (relationLeads(s, 0) === 3 ? null : "you lead 3 of 4 powers"),
  },
};

/**
 * Play a lesson to its end. Free stretches play `free` if given, else each free step's own
 * solution; a whole game (no solution) has the computer play the learner's seat.
 * Returns the finished run and the claims that were checked on the way.
 */
function playThrough(lesson: Lesson, free?: Expect[], seed = 7): { run: LessonRun; checked: Set<number> } {
  const rng = createSeededRng(seed);
  const wholeGame = isNewGame(lesson.scenario);
  let run = startLesson(lesson, seed);
  const problems = invariantIssues(run.state, null);
  assert(problems.length === 0, `${lesson.id}: the scenario is valid (${problems.join("; ")})`);
  // A whole game starts at the deal, with cards in setup zones: count once play begins.
  let cardCount: number | null = wholeGame ? null : allCards(run.state).length;
  const checked = new Set<number>();
  const override = free ? [...free] : null;
  let queue: Expect[] = [];
  let queueStep = -1;
  for (let guard = 0; guard < (wholeGame ? 5000 : 200) && run.outcome === "playing"; guard++) {
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
      if (!move.scripted && !wholeGame) fail(`${lesson.id}: the opponent ran out of script at step ${run.step} (${move.action.type})`);
      run = playOpponent(run, move, rng);
    } else if (step.kind === "explain") {
      run = acknowledge(run);
    } else {
      const label = `${lesson.id} step ${run.step} (${step.title})`;
      if (step.kind === "free" && !step.solution && !override) {
        // A whole game: the computer plays the learner's seat too.
        const action = chooseAiAction(run.state, LEARNER, "hard", rng) ?? legalActions(run.state, LEARNER)[0]!;
        const result = submit(run, action, rng);
        if ("hint" in result) {
          fail(`${label}: refused (${result.hint})`);
          break;
        }
        run = result.run;
        continue;
      }
      if (step.kind === "free" && queueStep !== run.step) {
        queue = override ?? [...(step.solution ?? [])];
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
    if (cardCount === null && run.state.phase !== Phase.Setup) cardCount = allCards(run.state).length;
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
  if (isNewGame(lesson.scenario)) {
    // A whole game ends with somebody's victory: complete if it's the learner's, failed if not.
    const winner = run.state.victory?.player;
    assert(winner !== undefined, `${lesson.id}: the game ends in a victory (outcome ${run.outcome})`);
    assert(run.outcome === (winner === LEARNER ? "complete" : "failed"), `${lesson.id}: the outcome follows the winner`);
  } else {
    assert(run.outcome === "complete", `${lesson.id}: the lesson completes (outcome ${run.outcome}, step ${run.step})`);
  }
  assert(run.script === lesson.script.length, `${lesson.id}: the opponent plays its whole script (${run.script}/${lesson.script.length})`);
  for (const index of Object.keys(CLAIMS[lesson.id] ?? {})) {
    assert(checked.has(Number(index)), `${lesson.id}: the claim at step ${index} was checked`);
  }
  for (const step of lesson.steps) {
    assert(step.title.length > 0 && step.body.length > 0, `${lesson.id}: every step has a title and words`);
    // The step's own spotlight, and the ones its several-click notes switch to.
    const targets = [step.target, ...(step.kind === "do" ? Object.values(step.stages ?? {}).map((note) => note.target) : [])];
    for (const target of targets) {
      if (!target) continue;
      assert(!(lesson.dim ?? []).includes(target), `${lesson.id}: "${step.title}" points at a dimmed area (${target})`);
      assert(!(lesson.hide ?? []).includes(target), `${lesson.id}: "${step.title}" points at a hidden area (${target})`);
      if (target.startsWith("lane:")) {
        assert((DISTRICTS as readonly string[]).includes(target.slice(5)), `${lesson.id}: ${target} is a district`);
      }
    }
  }
}

// --- Ids are unique; base and expansion lessons are set up as such ---------------------------------------------
{
  const ids = LESSONS.map((lesson) => lesson.id);
  assert(new Set(ids).size === ids.length, "Lesson ids are unique");
  assert(getLesson("first-day")?.title === "First Day in Town", "getLesson finds a lesson by id");
  const tables = (expansion: boolean) => LESSONS.filter((lesson) => Boolean(lesson.expansion) === expansion).map((lesson) => lesson.scenario);
  assert(tables(true).every((scenario) => !isNewGame(scenario) && scenario.expansion), "Expansion lessons set up the expansion");
  assert(tables(false).every((scenario) => isNewGame(scenario) || !scenario.expansion), "Base lessons stay base games");
  // Joe's ladder (2026-11-22): 6 base lessons in 3 chapters, then 2 optional expansion lessons.
  assert(LESSONS.length === 8 && tables(false).length === 6, "8 lessons, 6 of them base");
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

// --- A step asking for one policy (or one way to play an event) offers only that one ---------
{
  const law = getLesson("legislative")!;
  let run = startLesson(law);
  const rng = createSeededRng(5);
  while (shownStep(run)?.kind !== "do" || (shownStep(run) as { expect: Expect }).expect.type !== "proposePolicy") {
    const step = shownStep(run)!;
    if (step.kind === "explain") run = acknowledge(run);
    else if (step.kind === "do") {
      const action = legalActions(run.state, LEARNER).find((candidate) => matches(step.expect, candidate))!;
      const result = submit(run, action, rng);
      if ("run" in result) run = result.run;
    }
  }
  const proposal = (district: DistrictId, policyId: string | null) => ({
    type: "proposePolicy" as const,
    player: LEARNER,
    revealIds: ["horsard-a-1", "shavvinne-b-2"],
    discardId: "horsard-a-1",
    district,
    policyId: policyId as never,
  });
  assert(allows(run, proposal(District.Horsard, "horsard-a")), "Legislative: Economic Reform can be chosen");
  assert(!allows(run, proposal(District.Horsard, "horsard-b")), "Legislative: Market Regulation is closed");
  assert(!allows(run, proposal(District.Shavvinne, "shavvinne-b")), "Legislative: Secularism is closed");
  const discards = ["horsard-a-1", "shavvinne-b-2"].map((id) => ({ ...proposal(District.Horsard, "horsard-a"), discardId: id }));
  assert(discards.every((action) => allows(run, action)), "Legislative: either revealed card may be discarded");

  const events = getLesson("events")!;
  let buying = startLesson(events);
  while (!(shownStep(buying)?.kind === "do" && (shownStep(buying) as { expect: Expect }).expect.type === "buyEvent")) {
    const step = shownStep(buying)!;
    if (step.kind === "explain") buying = acknowledge(buying);
    else if (step.kind === "do") {
      const action = legalActions(buying.state, LEARNER).find((candidate) => matches(step.expect, candidate))!;
      const result = submit(buying, action, rng);
      if ("run" in result) buying = result.run;
    }
  }
  const buy = (use: "effect" | "civil"): Action => ({
    type: "buyEvent",
    player: LEARNER,
    instanceId: "ev-event-east-railway-bonds",
    payIds: [],
    use,
  });
  assert(allows(buying, buy("effect")) && !allows(buying, buy("civil")), "Events: only Play for its effect is open");
}

// --- Town Hall has no Politics step: it passes by itself, for both players -------------------
{
  const lesson = getLesson("first-day")!;
  let run = startLesson(lesson);
  const rng = createSeededRng(2);
  while (shownStep(run)?.kind === "explain") run = acknowledge(run);
  const play = legalActions(run.state, LEARNER).find((action) => allows(run, action))!;
  const result = submit(run, play, rng);
  assert("run" in result && result.run.state.phase === Phase.Income, "Town Hall: after the main action comes Income");
  if ("run" in result) {
    run = result.run;
    while (shownStep(run)?.kind === "explain") run = acknowledge(run);
    const take = legalActions(run.state, LEARNER).find((action) => allows(run, action))!;
    const taken = submit(run, take, rng);
    assert("run" in taken, "Town Hall: income is open");
    if ("run" in taken) {
      run = taken.run;
      const mildred = opponentMove(run, rng)!;
      run = playOpponent(run, mildred, rng);
      assert(run.state.phase === Phase.Income && run.state.activePlayer === OPPONENT, "Town Hall: Mildred skips Politics too");
    }
  }
  assert(getLesson("doorstep")!.skipPolitics === true && !getLesson("legislative")!.skipPolitics, "Politics returns at the Capital");
}

// --- A whole game against Vex: from the deal to a victory, at the Normal level ------------------
{
  const star = getLesson("star")!;
  assert(isNewGame(star.scenario) && star.opponentLevel === "normal", "A Star is Born is a whole game against Normal Vex");
  const first = startLesson(star, 11);
  const again = startLesson(star, 12);
  assert(first.state.phase === Phase.Setup && first.state.setup?.step === "chooseParty", "It starts at the party deal");
  assert(
    JSON.stringify(first.state.setup?.dealtParties) !== JSON.stringify(again.state.setup?.dealtParties) ||
      first.state.deck[0]?.cardId !== again.state.deck[0]?.cardId,
    "Another attempt deals another game",
  );
  // Several deals: someone playing well beats Normal Vex at least once.
  const outcomes: string[] = [];
  for (const seed of [3, 4, 5, 6, 8]) outcomes.push(playThrough(star, undefined, seed).run.outcome);
  assert(outcomes.includes("complete"), `A strong player beats Normal Vex at least once (${outcomes.join(", ")})`);
}

// --- The opponent waits while a `now` step is showing ----------------------------------------
{
  const lesson = getLesson("executive")!;
  let run = startLesson(lesson);
  const rng = createSeededRng(3);
  for (let guard = 0; guard < 50 && !(shownStep(run)?.now && run.step > 0); guard++) {
    const step = shownStep(run)!;
    if (step.kind === "explain") run = acknowledge(run);
    else if (step.kind === "do") {
      const action = legalActions(run.state, LEARNER).find((candidate) => matches(step.expect, candidate))!;
      const result = submit(run, action, rng);
      if ("run" in result) run = result.run;
    }
  }
  assert(run.state.decrees.filter((decree) => decree.active).length === 2, "The winner activated two decrees");
  assert(decider(run.state) === OPPONENT, "Crane moves next");
  assert(shownStep(run)?.now === true, "The Political Victory note shows at once");
  assert(opponentMove(run, rng) === null, "Crane waits until the note is read");
  run = acknowledge(run);
  assert(opponentMove(run, rng) !== null, "…then takes his turn");
}

report(`Tutorial ok: ${LESSONS.length} lessons play through; guided steps, Town Hall without politics, a whole game against Vex, and waiting notes.`);
