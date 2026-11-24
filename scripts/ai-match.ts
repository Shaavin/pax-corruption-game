/**
 * Play the computer against itself and report how a level fares: wins, how games end, its
 * moves per game, its agendas, and thinking time. For checking AI changes (one game is luck;
 * a few hundred tell levels apart).
 *
 * Usage:
 *   node --experimental-strip-types --no-warnings scripts/ai-match.ts <level> <level> [games] [--expansion] [--from N]
 *
 * Levels: easy, normal, hard. The first is reported on. Seats alternate game by game, and the
 * deals are fixed by `--from` (default 1), so two runs with the same games compare like with like.
 * Several runs with different `--from` can go in parallel.
 */
import { aiAgenda, chooseAiAction, isAiLevel, type AiLevel } from "../lib/game/ai.ts";
import { currentActor } from "../lib/game/engine.ts";
import { newReplay, stepReplay } from "../lib/game/record.ts";
import { createSeededRng } from "../lib/game/rng.ts";
import type { PlayerId } from "../lib/game/types.ts";

const args = process.argv.slice(2);
const [a, b] = args.filter((arg) => isAiLevel(arg)) as AiLevel[];
if (!a || !b) {
  console.error("Usage: scripts/ai-match.ts <easy|normal|hard> <easy|normal|hard> [games] [--expansion] [--from N]");
  process.exit(1);
}
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
    if (mine && actor !== last && replay.state.phase !== "setup") {
      const agenda = aiAgenda(replay.state, actor, a);
      agendas[agenda] = (agendas[agenda] ?? 0) + 1;
      if (previous && agenda !== previous) switches++;
      previous = agenda;
    }
    last = actor;
    const started = performance.now();
    const action = chooseAiAction(replay.state, actor, mine ? a : b, rng);
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
  const key = `${victory.player === seat ? a : b} ${victory.kind}`;
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
console.log(`${a} vs ${b}${expansion ? " (expansion)" : ""}, games ${from}–${from + games - 1}: ${a} won ${won}/${finished} (${Math.round((100 * won) / Math.max(1, finished))}%)`);
console.log(`  how games ended: ${Object.entries(ends).sort().map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`  ${a}'s moves per game: ${MOVES.map((name) => `${name} ${((moves[name] ?? 0) / games).toFixed(1)}`).join(", ")}`);
console.log(`  ${a}'s agendas (share of turns): ${share(agendas)}; ${(switches / games).toFixed(1)} switches per game`);
for (const [side, level] of [["a", a], ["b", b]] as const) {
  const clock = think[side];
  console.log(`  ${level} (${side === "a" ? "first" : "second"}): ${(clock.ms / Math.max(1, clock.n)).toFixed(1)} ms per move, longest ${clock.max.toFixed(0)} ms`);
}
