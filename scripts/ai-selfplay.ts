/**
 * Self-play games for training the learned evaluator (training/train.py). Each game is played
 * to the end and saved as its record (seed and moves); scripts/ai-encode.ts turns records into
 * training positions, so a new feature layout only needs the records encoded again.
 *
 * Usage:
 *   node --experimental-strip-types --no-warnings scripts/ai-selfplay.ts --out <dir> [options]
 *
 * Options:
 *   --games N        games to play (default 200)
 *   --from N         first game number; deals and seats follow from it (default 1)
 *   --players A,B    who plays: easy, normal, hard, quick (Hard's search, this turn only),
 *                    net:<weights.bin> (the learned evaluator in Hard's search), or
 *                    netquick:<weights.bin> (the same, this turn only: fast, for generating games),
 *                    or quick:<agenda> (quick, fixed on one agenda: ideology, military, …);
 *                    net and netquick take @<agenda>[=lean] to lean the evaluator toward one
 *                    agenda (lean in the evaluator's units, 100 per logit; default 100), so a
 *                    strong player takes a road the evaluator rarely tries (and is defended
 *                    against): netquick:<weights.bin>@ideology; or
 *                    ninth:<weights.bin>[+noreply] (The Ninth as it plays in the game)
 *                    seats alternate game by game (default quick,quick)
 *   --explore P      chance of a random legal move, so games differ (default 0.04)
 *   --expansion      Legacy & Diplomacy games (with --foreign: and Foreign Influence)
 *   --mode M         deck mode: standard (default), tourney, chaotic, epic, or mixed (by game)
 *
 * Writes <dir>/g<from>-<to>.records.jsonl: one finished game per line (game number, seed,
 * players by seat, winner, victory kind, moves), each saved as it finishes; run again with the
 * same options to finish an interrupted run. Several runs with different --from can go in
 * parallel.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Agenda, focusWeights, type AgendaId } from "../lib/game/ai-agenda.ts";
import { loadNet, netEvaluator } from "../lib/game/ai-net.ts";
import { CLASSIC } from "../lib/game/ai-score.ts";
import { chooseAiAction, isAiLevel, leanFromSpec, ninthPlayer, planMove, positionScore } from "../lib/game/ai.ts";
import { currentActor, legalActions } from "../lib/game/engine.ts";
import { newReplay, stepReplay } from "../lib/game/record.ts";
import { createSeededRng, type Rng } from "../lib/game/rng.ts";
import type { Action, GameState, PlayerId } from "../lib/game/types.ts";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] !== undefined ? args[at + 1]! : fallback;
};
const out = option("out", "");
if (!out) {
  console.error("Usage: scripts/ai-selfplay.ts --out <dir> [--games N] [--from N] [--players A,B] [--explore P]");
  process.exit(1);
}
const games = Number(option("games", "200"));
const from = Number(option("from", "1"));
const explore = Number(option("explore", "0.04"));
const players = option("players", "quick,quick").split(",");
const expansion = args.includes("--expansion");
const foreignInfluence = expansion && args.includes("--foreign");
/** Deck mode: standard, tourney, chaotic, epic, or "mixed" (one per game, by game number). */
const modeOption = option("mode", "standard");
const MODES = ["standard", "tourney", "chaotic", "epic"] as const;
const modeFor = (game: number) => (modeOption === "mixed" ? MODES[game % MODES.length]! : (modeOption as (typeof MODES)[number]));

type Mover = (state: GameState, seat: PlayerId, rng: Rng) => Action | null;

const chance = (rng: Rng, p: number) => rng.nextInt(1_000_000) < p * 1_000_000;

function mover(spec: string): Mover {
  if (isAiLevel(spec)) return (state, seat, rng) => chooseAiAction(state, seat, spec, rng);
  if (spec === "quick") return (state, seat, rng) => planMove(state, seat, rng, positionScore, false);
  if (spec.startsWith("quick:")) {
    // quick:<agenda>: the same, fixed on one agenda at full strength (ideology, military, …), so
    // the games show every road to victory, and the defence against it. quick:any takes a
    // different agenda each game (by the deal).
    const name = spec.slice(6);
    const agendas = (name === "any" ? Object.values(Agenda).filter((agenda) => agenda !== Agenda.Diplomacy || expansion) : [name]) as AgendaId[];
    for (const agenda of agendas) if (!Object.values(Agenda).includes(agenda)) throw new Error(`Unknown agenda ${agenda}`);
    const weights = new Map(agendas.map((agenda) => [agenda, focusWeights(CLASSIC, agenda, 1)]));
    return (state, seat, rng) => {
      const w = weights.get(agendas[state.seed % agendas.length]!)!;
      return planMove(state, seat, rng, (position, player) => positionScore(position, player, w), false);
    };
  }
  if (spec.startsWith("net:") || spec.startsWith("netquick:")) {
    const quick = spec.startsWith("netquick:");
    const [path, focus] = spec.slice(spec.indexOf(":") + 1).split("@");
    const evaluate = leanFromSpec(netEvaluator(loadNet(readFileSync(path!))), focus);
    return (state, seat, rng) => planMove(state, seat, rng, evaluate, !quick);
  }
  if (spec.startsWith("ninth:")) {
    // ninth:<weights.bin>[+noreply]: The Ninth as it plays in the game (its whole search, the
    // opponent's reply judged by its evaluator). Several times slower than netquick, but its
    // games are played as well as it can. For Legacy & Diplomacy, give the expansion network.
    return ninthPlayer(loadNet(readFileSync(spec.slice(6).replace(/\+.*$/, ""))), { reply: !spec.includes("+noreply") });
  }
  throw new Error(`Unknown player ${spec}`);
}
const movers = players.map(mover);

// Each finished game is saved at once, so an interrupted run keeps what it played and picks up
// where it stopped when run again with the same options.
mkdirSync(out, { recursive: true });
const file = join(out, `g${from}-${from + games - 1}.records.jsonl`);
const done = new Set<number>(
  existsSync(file)
    ? readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => (JSON.parse(line) as { game: number }).game)
    : [],
);
let finished = done.size;
const wins: Record<string, number> = {};

const started = Date.now();
for (let game = from; game < from + games; game++) {
  if (done.has(game)) continue;
  const rng = createSeededRng(game * 2654435761);
  // Seats alternate: player A sits first in odd games.
  const seats: [Mover, Mover] = game % 2 === 1 ? [movers[0]!, movers[1] ?? movers[0]!] : [movers[1] ?? movers[0]!, movers[0]!];
  const names: [string, string] = game % 2 === 1 ? [players[0]!, players[1] ?? players[0]!] : [players[1] ?? players[0]!, players[0]!];
  const seed = 100_000 + game;
  const mode = modeFor(game);
  let replay = newReplay(seed, { mode, expansion, foreignInfluence });
  const actions: Action[] = [];
  for (let step = 0; step < 3000 && !replay.state.victory; step++) {
    const state = replay.state;
    const actor = currentActor(state);
    let action: Action | null;
    if (state.phase !== "setup" && chance(rng, explore)) {
      const options = legalActions(state, actor);
      action = options[rng.nextInt(options.length)] ?? null;
    } else {
      action = seats[actor](state, actor, rng);
    }
    if (!action) break;
    replay = stepReplay(replay, action);
    actions.push(action);
  }
  const victory = replay.state.victory;
  if (!victory) continue;
  wins[names[victory.player]] = (wins[names[victory.player]] ?? 0) + 1;
  const options = { ...(mode !== "standard" ? { mode } : {}), ...(expansion ? { expansion, foreignInfluence } : {}) };
  appendFileSync(file, `${JSON.stringify({ game, seed, ...options, players: names, winner: victory.player, kind: victory.kind, actions })}\n`);
  finished++;
}

console.log(JSON.stringify({ file, games, finished, players, wins, explore, seconds: Math.round((Date.now() - started) / 1000) }));
