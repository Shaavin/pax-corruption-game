/** The computer opponent: always legal, finishes games, and Normal beats Easy and random play. */
import { chooseAiAction, positionScore, type AiLevel } from "./ai.ts";
import { currentActor, legalActions } from "./engine.ts";
import { newReplay, stepReplay } from "./record.ts";
import { createSeededRng } from "./rng.ts";
import { assert, report } from "./test-helpers.ts";
import type { PlayerId } from "./types.ts";

type Player = AiLevel | "random";

/** Play one game; returns the winner's seat (null if it didn't finish). */
function game(seed: number, players: Record<PlayerId, Player>, expansion = false): PlayerId | null {
  const rng = createSeededRng(seed * 97 + 13);
  let replay = newReplay(seed, { expansion });
  for (let i = 0; i < 2000 && !replay.state.victory; i++) {
    const actor = currentActor(replay.state);
    const who = players[actor];
    let action;
    if (who === "random") {
      const options = legalActions(replay.state, actor);
      action = options[rng.nextInt(options.length)];
    } else {
      action = chooseAiAction(replay.state, actor, who, rng);
    }
    assert(action, `seed ${seed} step ${i}: no move for ${who}`);
    replay = stepReplay(replay, action!); // throws if the move were illegal
  }
  return replay.state.victory?.player ?? null;
}

// Finishes games (base and expansion) with only legal moves.
let finished = 0;
for (const seed of [1, 2, 3]) {
  for (const expansion of [false, true]) {
    if (game(seed, { 0: "normal", 1: "normal" }, expansion) !== null) finished++;
  }
}
assert(finished === 6, `Normal vs Normal finished ${finished}/6 games`);

// Normal should clearly beat weaker play (seats alternate so going first doesn't decide it).
function wins(level: Player, against: Player, games: number): number {
  let won = 0;
  for (let seed = 1; seed <= games; seed++) {
    const seat: PlayerId = seed % 2 === 0 ? 0 : 1;
    const players = (seat === 0 ? { 0: level, 1: against } : { 0: against, 1: level }) as Record<PlayerId, Player>;
    if (game(100 + seed, players) === seat) won++;
  }
  return won;
}
const vsRandom = wins("normal", "random", 20);
const vsEasy = wins("normal", "easy", 20);
assert(vsRandom >= 15, `Normal beat random play ${vsRandom}/20`);
assert(vsEasy >= 12, `Normal beat Easy ${vsEasy}/20`);

// The score reads the board, not the opponent's hidden hand.
{
  const replay = newReplay(5, {});
  let state = replay.state;
  for (let i = 0; i < 40 && state.phase !== "action"; i++) state = stepReplay({ ...replay, state, steps: [] }, legalActions(state, currentActor(state))[0]!).state;
  const before = positionScore(state, 0);
  const swapped = structuredClone(state);
  swapped.players[1].hand.reverse();
  assert(positionScore(swapped, 0) === before, "Reordering the opponent's hand doesn't change the score");
}

report(`AI ok: legal and finishes games; Normal beat random play ${vsRandom}/20 and Easy ${vsEasy}/20.`);
