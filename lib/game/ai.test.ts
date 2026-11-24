/**
 * The computer opponent: always legal, finishes games, each level beats the one below it, and
 * its agendas make games differ (different openings, switching when the board turns, building
 * monuments when that's the plan).
 */
import { getCard } from "../cards/catalog.ts";
import { CardKind } from "../cards/schema.ts";
import { Agenda, focusWeights } from "./ai-agenda.ts";
import { CLASSIC } from "./ai-score.ts";
import { aiAgenda, chooseAiAction, guessOpponentHand, positionScore, type AiLevel } from "./ai.ts";
import { apply, currentActor, legalActions } from "./engine.ts";
import { newReplay, stepReplay, type Replay } from "./record.ts";
import { createSeededRng } from "./rng.ts";
import { assert, report } from "./test-helpers.ts";
import type { GameState, PlayerId } from "./types.ts";

type Player = AiLevel | "random";

/** Play one game; returns the winner's seat (null if it didn't finish) and each seat's agenda turn by turn. */
function game(seed: number, players: Record<PlayerId, Player>, expansion = false) {
  const rng = createSeededRng(seed * 97 + 13);
  let replay = newReplay(seed, { expansion });
  const agendas: Record<PlayerId, string[]> = { 0: [], 1: [] };
  let last: PlayerId | null = null;
  for (let i = 0; i < 2000 && !replay.state.victory; i++) {
    const actor = currentActor(replay.state);
    const who = players[actor];
    if (who !== "random" && actor !== last && replay.state.phase !== "setup") agendas[actor].push(aiAgenda(replay.state, actor, who));
    last = actor;
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
  return { winner: replay.state.victory?.player ?? null, agendas };
}

// Finishes games (base and expansion) with only legal moves.
let finished = 0;
for (const seed of [1, 2, 3]) {
  for (const expansion of [false, true]) {
    if (game(seed, { 0: "hard", 1: "normal" }, expansion).winner !== null) finished++;
  }
}
assert(finished === 6, `Hard vs Normal finished ${finished}/6 games`);

// Each level should clearly beat the one below (seats alternate so going first doesn't decide it).
function wins(level: Player, against: Player, games: number): number {
  let won = 0;
  for (let seed = 1; seed <= games; seed++) {
    const seat: PlayerId = seed % 2 === 0 ? 0 : 1;
    const players = (seat === 0 ? { 0: level, 1: against } : { 0: against, 1: level }) as Record<PlayerId, Player>;
    if (game(100 + seed, players).winner === seat) won++;
  }
  return won;
}
const vsRandom = wins("easy", "random", 20);
const normalVsEasy = wins("normal", "easy", 20);
const hardVsNormal = wins("hard", "normal", 20);
assert(vsRandom >= 12, `Easy beat random play ${vsRandom}/20`);
assert(normalVsEasy >= 12, `Normal beat Easy ${normalVsEasy}/20`);
assert(hardVsNormal >= 12, `Hard beat Normal ${hardVsNormal}/20`);

// Games differ: deals open with different agendas, and a seat switches when the board turns,
// without flip-flopping every turn.
const openings = new Set<string>();
let switches = 0;
let turns = 0;
for (let seed = 200; seed < 212; seed++) {
  const { agendas } = game(seed, { 0: "normal", 1: "normal" });
  for (const seat of [0, 1] as const) {
    const list = agendas[seat];
    if (list[0]) openings.add(list[0]);
    for (let index = 1; index < list.length; index++) if (list[index] !== list[index - 1]) switches++;
    turns += list.length;
  }
}
assert(openings.size >= 4, `Normal opened 24 seats with only ${openings.size} agendas: ${[...openings].join(", ")}`);
assert(switches >= 2, `Normal switched agenda ${switches} times in 12 games`);
assert(switches <= turns / 4, `Normal switched agenda ${switches} times in ${turns} turns (flip-flopping)`);

/** The first position where `seat` is about to play its main action. */
function mainActionTurn(seed: number, seat: PlayerId): GameState {
  const rng = createSeededRng(seed);
  let replay: Replay = newReplay(seed, {});
  for (let i = 0; i < 400; i++) {
    const state = replay.state;
    if (state.phase === "action" && currentActor(state) === seat && !state.turn.mainActionDone) return state;
    replay = stepReplay(replay, chooseAiAction(state, currentActor(state), "normal", rng)!);
  }
  throw new Error(`seed ${seed}: no main action for seat ${seat}`);
}

// On the Monuments agenda it builds once it holds the cards: building beats every other move.
{
  let built = 0;
  let tried = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const state = structuredClone(mainActionTurn(seed, 0));
    const monument = getCard(state.availableMonuments[0]!.cardId);
    if (!("district" in monument)) continue;
    // Hand it five civil cards of that district from the deck (its own cards go back to the deck).
    const set = state.deck.filter((card) => {
      const def = getCard(card.cardId);
      return def.kind === CardKind.Civil && def.district === monument.district;
    }).slice(0, 5);
    if (set.length < 5) continue;
    state.deck = [...state.deck.filter((card) => !set.includes(card)), ...state.players[0].hand];
    state.players[0].hand = set;
    const options = legalActions(state, 0);
    if (!options.some((action) => action.type === "construct")) continue;
    const w = focusWeights(CLASSIC, Agenda.Monuments, 0.9);
    const ranked = options
      .map((action) => ({ action, score: positionScore(apply(state, action, createSeededRng(seed)).state, 0, w) }))
      .sort((a, b) => b.score - a.score);
    tried++;
    if (ranked[0]!.action.type === "construct") built++;
  }
  assert(tried >= 4, `Only ${tried} positions to test building in`);
  assert(built === tried, `On the Monuments agenda it built in ${built} of ${tried} positions where it could`);
}

// The score reads the board, not the opponent's hidden hand.
{
  const state = mainActionTurn(5, 0);
  const before = positionScore(state, 0);
  const swapped = structuredClone(state);
  swapped.players[1].hand.reverse();
  assert(positionScore(swapped, 0) === before, "Reordering the opponent's hand doesn't change the score");
}

// Guessing the opponent's hand deals from what it can't see: no card made or lost, cards taken
// from the Market (face up) kept, its own hand untouched, no General Election in a hand.
{
  const state = structuredClone(mainActionTurn(7, 0));
  state.players[1].hand[0]!.faceUp = true;
  const ids = (s: GameState) => [...s.players[1].hand, ...s.deck].map((card) => card.instanceId).sort().join();
  for (let sample = 0; sample < 20; sample++) {
    const guess = guessOpponentHand(state, 0, createSeededRng(sample));
    assert(ids(guess) === ids(state), "Guessing a hand keeps the same cards between hand and deck");
    assert(guess.players[1].hand.length === state.players[1].hand.length, "The guessed hand keeps its size");
    assert(guess.players[1].hand.some((card) => card.instanceId === state.players[1].hand[0]!.instanceId), "A face-up card stays in the hand");
    assert(JSON.stringify(guess.players[0].hand) === JSON.stringify(state.players[0].hand), "Its own hand is untouched");
    assert(!guess.players[1].hand.some((card) => getCard(card.cardId).kind === CardKind.Election), "No General Election in a hand");
  }
}

report(
  `AI ok: legal and finishes games; Easy beat random play ${vsRandom}/20, Normal beat Easy ${normalVsEasy}/20, Hard beat Normal ${hardVsNormal}/20; ` +
    `${openings.size} opening agendas, ${switches} switches in 12 games; builds when it can on the Monuments agenda; guessed hands deal fairly.`,
);
