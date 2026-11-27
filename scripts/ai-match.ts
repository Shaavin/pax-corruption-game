/**
 * Play the computer against itself and report how a level fares: wins, how games end, its
 * moves per game, its agendas, and thinking time. For checking AI changes (one game is luck;
 * a few hundred tell levels apart).
 *
 * Usage:
 *   node --experimental-strip-types --no-warnings scripts/ai-match.ts <player> <player> [games] [--expansion] [--from N]
 *
 * Players: easy, normal, hard; quick (Hard's search, this turn only); net:<weights.bin> (the
 * learned evaluator in Hard's search); netquick:<weights.bin> (the same, this turn only); either
 * takes @<agenda>[=strength] to lean toward an agenda (netquick:<weights.bin>@ideology=600);
 * ninth:<weights.bin>[@lean][+exp=<weights.bin>][+noreply] (The Ninth as in the game: that
 * evaluator, nudged by its agenda; +exp: its Legacy & Diplomacy specialist; +noreply: the
 * opponent's reply predicted with Hard's score, as before 2026-11-26). Two ninth: players can
 * meet (two evaluators, or two ways of searching). The first is reported on. Seats alternate
 * game by game, and the deals are fixed by `--from` (default 1), so two runs with the same games
 * compare like with like. Several runs with different `--from` can go in parallel. `--log`
 * prints each game's result.
 */
import { readFileSync } from "node:fs";
import { focusWeights, type AgendaId } from "../lib/game/ai-agenda.ts";
import { loadNet, netEvaluator } from "../lib/game/ai-net.ts";
import { CLASSIC } from "../lib/game/ai-score.ts";
import { aiAgenda, chooseAiAction, isAiLevel, leanFromSpec, ninthPlayer, planMove, positionScore } from "../lib/game/ai.ts";
import type { Rng } from "../lib/game/rng.ts";
import type { Action, GameState } from "../lib/game/types.ts";
import { currentActor } from "../lib/game/engine.ts";
import { newReplay, stepReplay } from "../lib/game/record.ts";
import { createSeededRng } from "../lib/game/rng.ts";
import type { PlayerId } from "../lib/game/types.ts";

const args = process.argv.slice(2);
const isPlayer = (arg: string) => isAiLevel(arg) || arg === "quick" || /^(net|netquick|ninth|quick):/.test(arg);
const [a, b] = args.filter(isPlayer);
if (!a || !b) {
  console.error("Usage: scripts/ai-match.ts <player> <player> [games] [--expansion] [--from N]  (easy, normal, hard, quick, net:<weights.bin>)");
  process.exit(1);
}

type Mover = (state: GameState, seat: PlayerId, rng: Rng) => Action | null;
function mover(spec: string): Mover {
  if (isAiLevel(spec)) return (state, seat, rng) => chooseAiAction(state, seat, spec, rng);
  if (spec.startsWith("quick:")) {
    // quick:<agenda>: Hard's search for this turn, fixed on one agenda at full strength.
    const weights = focusWeights(CLASSIC, spec.slice(6) as AgendaId, 1);
    return (state, seat, rng) => planMove(state, seat, rng, (position, player) => positionScore(position, player, weights), false);
  }
  if (spec.startsWith("ninth:")) {
    // ninth:<weights.bin>[@lean][+noreply]: The Ninth as it plays in the game (agenda and all);
    // +noreply predicts the opponent's reply with Hard's score instead of the evaluator.
    // +wide=<candidates>x<samples> looks past its turn on more plans and guesses.
    // +exp=<weights.bin> plays Legacy & Diplomacy games with that evaluator instead.
    const reply = !spec.includes("+noreply");
    const wide = /\+wide=(\d+)x(\d+)/.exec(spec);
    const specialist = /\+exp=([^+]+)/.exec(spec);
    const [path, lean] = spec.slice(6).replace(/\+.*$/, "").split("@");
    // Each one is a Ninth of its own, so two can play each other.
    return ninthPlayer(loadNet(readFileSync(path!)), {
      expansion: specialist ? loadNet(readFileSync(specialist[1]!)) : null,
      ...(lean === undefined ? {} : { lean: Number(lean) }),
      reply,
      ...(wide ? { width: { candidates: Number(wide[1]), samples: Number(wide[2]) } } : {}),
    });
  }
  if (spec === "quick") return (state, seat, rng) => planMove(state, seat, rng, positionScore, false);
  // net:<weights.bin>@<agenda>[=strength]: leaning toward an agenda, as in scripts/ai-selfplay.ts.
  const [path, focus] = spec.slice(spec.indexOf(":") + 1).split("@");
  const evaluate = leanFromSpec(netEvaluator(loadNet(readFileSync(path!))), focus);
  return (state, seat, rng) => planMove(state, seat, rng, evaluate, !spec.startsWith("netquick:"));
}
const moveA = mover(a);
const moveB = mover(b);
const short = (spec: string) => (spec.includes(":") ? `${spec.slice(0, spec.indexOf(":"))}(${spec.replace(/\+.*$/, "").split(/[\/:]/).pop()})` : spec);
// Two players that look alike (the same weights, searching two ways) keep their options in the name.
const label = (spec: string) => (short(a) === short(b) && a !== b ? `${short(spec)}${spec.match(/\+.*$/)?.[0] ?? ""}` : short(spec));
const games = Number(args.find((arg) => /^\d+$/.test(arg) && args[args.indexOf(arg) - 1] !== "--from") ?? 20);
const expansion = args.includes("--expansion");
const from = Number(args[args.indexOf("--from") + 1] ?? 1) || 1;

const MOVES = ["playCivil", "playAlliance", "playConspiracy", "recruit", "construct", "influenceSenate", "proposePolicy", "buyEvent"];
const ends: Record<string, number> = {};
const moves: Record<string, number> = {};
const agendas: Record<string, number> = {};
let won = 0;
let finished = 0;
let switches = 0;
const think = { a: { ms: 0, n: 0, max: 0 }, b: { ms: 0, n: 0, max: 0 } };

for (let game = from; game < from + games; game++) {
  const seat: PlayerId = game % 2 === 0 ? 0 : 1;
  const rng = createSeededRng(game * 7919 + 5);
  let replay = newReplay(5000 + game, { expansion });
  let last: PlayerId | null = null;
  let previous: string | null = null;
  for (let step = 0; step < 3000 && !replay.state.victory; step++) {
    const actor = currentActor(replay.state);
    const mine = actor === seat;
    if (mine && isAiLevel(a) && actor !== last && replay.state.phase !== "setup") {
      const agenda = aiAgenda(replay.state, actor, a);
      agendas[agenda] = (agendas[agenda] ?? 0) + 1;
      if (previous && agenda !== previous) switches++;
      previous = agenda;
    }
    last = actor;
    const started = performance.now();
    const action = (mine ? moveA : moveB)(replay.state, actor, rng);
    const took = performance.now() - started;
    const clock = mine ? think.a : think.b;
    clock.ms += took;
    clock.n++;
    clock.max = Math.max(clock.max, took);
    if (!action) throw new Error(`game ${game}: no move at step ${step}`);
    if (mine && MOVES.includes(action.type)) moves[action.type] = (moves[action.type] ?? 0) + 1;
    replay = stepReplay(replay, action);
  }
  const victory = replay.state.victory;
  if (!victory) continue;
  finished++;
  const key = `${label(victory.player === seat ? a : b)} ${victory.kind}`;
  // --log: one line per game, to find the games worth replaying.
  if (args.includes("--log")) console.log(`game ${game}: ${key} (${label(a)} in seat ${seat})`);
  ends[key] = (ends[key] ?? 0) + 1;
  if (victory.player === seat) won++;
}

const share = (counts: Record<string, number>) => {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;
  return Object.entries(counts)
    .sort((x, y) => y[1] - x[1])
    .map(([name, count]) => `${name} ${Math.round((100 * count) / total)}%`)
    .join(", ");
};
console.log(`${label(a)} vs ${label(b)}${expansion ? " (expansion)" : ""}, games ${from}–${from + games - 1}: ${label(a)} won ${won}/${finished} (${Math.round((100 * won) / Math.max(1, finished))}%)`);
console.log(`  how games ended: ${Object.entries(ends).sort().map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`  ${label(a)}'s moves per game: ${MOVES.map((name) => `${name} ${((moves[name] ?? 0) / games).toFixed(1)}`).join(", ")}`);
if (isAiLevel(a)) console.log(`  ${a}'s agendas (share of turns): ${share(agendas)}; ${(switches / games).toFixed(1)} switches per game`);
for (const [side, level] of [["a", a], ["b", b]] as const) {
  const clock = think[side];
  console.log(`  ${label(level)} (${side === "a" ? "first" : "second"}): ${(clock.ms / Math.max(1, clock.n)).toFixed(1)} ms per move, longest ${clock.max.toFixed(0)} ms`);
}
