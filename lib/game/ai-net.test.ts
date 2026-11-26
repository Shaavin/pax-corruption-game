/**
 * The learned evaluator: the position encoding is fair (the opponent's face-down cards never show
 * through), knows which victories are active and which Ideological copies are still to be had, the shipped weights (main and Legacy & Diplomacy)
 * load and compute what PyTorch computed, and weights for another feature layout are refused.
 */
import { readFileSync } from "node:fs";
import { PARTIES, POLICIES } from "../cards/catalog.ts";
import { DISTRICTS } from "../cards/schema.ts";
import { DENSE_COUNT, DENSE_NAMES, encodeState, FEATURE_VERSION, SPARSE_COUNT } from "./ai-features.ts";
import { EVALUATOR_PATH, EXPANSION_EVALUATOR_PATH, loadNet, netLogit, winChance } from "./ai-net.ts";
import { chooseAiAction, ninthEvaluatorLoaded, setNinthEvaluator } from "./ai.ts";
import { decreeSymbol } from "./decrees.ts";
import { currentActor } from "./engine.ts";
import { newReplay, stepReplay } from "./record.ts";
import { createSeededRng } from "./rng.ts";
import { assert, report } from "./test-helpers.ts";
import type { GameState } from "./types.ts";

/** A mid-game position: both hands full, cards on the table. */
function midGame(seed: number, moves: number): GameState {
  const rng = createSeededRng(seed);
  let replay = newReplay(seed, {});
  for (let i = 0; i < moves && !replay.state.victory; i++) replay = stepReplay(replay, chooseAiAction(replay.state, currentActor(replay.state), "normal", rng)!);
  return replay.state;
}
const same = (a: ReturnType<typeof encodeState>, b: ReturnType<typeof encodeState>) =>
  a.sparse.join() === b.sparse.join() && a.dense.join() === b.dense.join();

// The opponent's face-down cards look the same as the deck: swapping them changes nothing.
{
  const state = midGame(3, 40);
  const before = encodeState(state, 0);
  const swapped = structuredClone(state);
  const theirs = swapped.players[1].hand.filter((card) => !card.faceUp);
  assert(theirs.length > 0, "The opponent holds face-down cards");
  const fromDeck = swapped.deck.splice(0, theirs.length, ...theirs);
  swapped.players[1].hand = [...swapped.players[1].hand.filter((card) => card.faceUp), ...fromDeck];
  assert(same(encodeState(swapped, 0), before), "Swapping the opponent's face-down hand with deck cards doesn't change what seat 0 sees");
  // …but seat 1 sees its own hand.
  assert(!same(encodeState(swapped, 1), encodeState(state, 1)), "A seat sees its own hand");

  // A card they took face up from the Market is known.
  const shown = structuredClone(state);
  shown.players[1].hand[0]!.faceUp = true;
  assert(!same(encodeState(shown, 0), before), "A face-up card in their hand is seen");

  assert(before.dense.length === DENSE_COUNT && before.sparse.every((index) => index >= 0 && index < SPARSE_COUNT), "Features are in range");
  assert(before.sparse.every((index, at) => at === 0 || index > before.sparse[at - 1]!), "Sparse indices are sorted and unique");
}

// Election timing from the deck's piles: Tourney puts each General Election at a pile's bottom,
// so the first is exactly 11 cards away at the start (pile A: 10 cards, then the election).
{
  const rng = createSeededRng(9);
  let replay = newReplay(9, { mode: "tourney" });
  while (replay.state.phase === "setup") replay = stepReplay(replay, chooseAiAction(replay.state, currentActor(replay.state), "normal", rng)!);
  const dense = encodeState(replay.state, 0).dense;
  const value = (name: string) => dense[DENSE_NAMES.indexOf(name)]!;
  assert(Math.round(value("electionsLeft") * 4) === 4, "Four General Elections are left at the start");
  const next = value("cardsToNextElection") * 30;
  assert(Math.abs(next - (11 - (91 - replay.state.deck.length))) < 1e-3, `The first Tourney election is 11 cards in (got ${next})`);
}

// Legacy & Diplomacy: a victory's condition counts as met only while the victory is active.
{
  const rng = createSeededRng(12);
  let replay = newReplay(12, { expansion: true });
  while (replay.state.phase === "setup") replay = stepReplay(replay, chooseAiAction(replay.state, currentActor(replay.state), "normal", rng)!);
  const ahead = (active: boolean) => {
    const state = structuredClone(replay.state);
    state.players[0].partisans = 6;
    state.players[1].partisans = 0;
    state.expansion!.activeVictories = active ? ["military"] : [];
    const dense = encodeState(state, 0).dense;
    return [dense[DENSE_NAMES.indexOf("military:metMine")], dense[DENSE_NAMES.indexOf("military:metInactiveMine")]];
  };
  assert(ahead(false).join() === "0,1", "Six partisans ahead with Military Victory inactive: met but inactive, not met");
  assert(ahead(true).join() === "1,0", "Six partisans ahead with Military Victory active: met");
}

// The Ideological outlook: which copies of a symbol are still to be had. Seat 0's party is atom,
// one atom policy and the atom decree are in effect: three copies, one to go.
{
  const rng = createSeededRng(12);
  let replay = newReplay(12);
  while (replay.state.phase === "setup") replay = stepReplay(replay, chooseAiAction(replay.state, currentActor(replay.state), "normal", rng)!);
  const [first, second] = POLICIES.filter((policy) => policy.symbol === "atom");
  const across = POLICIES.find((policy) => policy.district === second!.district && policy.id !== second!.id)!;
  const outlook = (secondPolicy: string | null) => {
    const state = structuredClone(replay.state);
    state.players[0].partyId = PARTIES.find((party) => party.symbol === "atom")!.id;
    state.players[1].partyId = PARTIES.find((party) => party.symbol !== "atom")!.id;
    state.players[0].monuments = [];
    state.players[1].monuments = [];
    state.availableMonuments = [];
    for (const district of DISTRICTS) state.policy[district] = null;
    state.policy[first!.district] = first!.id;
    state.policy[second!.district] = secondPolicy as never;
    for (const decree of state.decrees) decree.active = decreeSymbol(decree.id) === "atom";
    const dense = encodeState(state, 0).dense;
    const read = (name: string) => dense[DENSE_NAMES.indexOf(name)]!;
    return {
      mine: [read("ideology:atom:policyNeutral"), read("ideology:atom:policyAcross"), read("ideology:atom:decreeOpen"), read("ideology:atom:toGo")].join(),
      road: [read("ideology:roadOpenMine"), read("ideology:oneMoveMine"), read("ideology:roadOpenTheirs"), read("ideology:oneMoveTheirs")].join(),
    };
  };
  const neutral = outlook(null);
  assert(neutral.mine === "0.5,0,0,0.25", `The other atom policy is one proposal away, the decree is taken, one copy to go (got ${neutral.mine})`);
  // Seat 1's party symbol still has its roads open too, but it is far from four copies.
  assert(neutral.road === "1,1,1,0", `Seat 0 is one move from Ideological Victory; seat 1 isn't (got ${neutral.road})`);
  const flipped = outlook(across.id);
  assert(flipped.mine === "0,0.5,0,0.25", `With the other side in effect, the atom policy is two proposals away (got ${flipped.mine})`);
  assert(flipped.road === "1,0,1,0", `Still open, but not one move away (got ${flipped.road})`);

  // Proposal readiness: a Senate of low Dragonara cards, and a higher Dragonara card to reveal.
  // The opponent's counts only once it can be seen (taken face up).
  const state = structuredClone(replay.state);
  const card = (cardId: string, faceUp = false) => ({ instanceId: `test-${cardId}`, cardId, faceUp });
  state.senate = ["dragonara-b-9", "dragonara-b-18", "dragonara-b-8", "dragonara-b-16", "dragonara-b-17"].map((id) => card(id));
  state.players[0].hand = [card("dragonara-b-1")];
  state.players[0].network = [];
  state.players[1].network = [];
  const ready = (theirs: ReturnType<typeof card>) => {
    state.players[1].hand = [theirs];
    const dense = encodeState(state, 0).dense;
    const read = (name: string) => dense[DENSE_NAMES.indexOf(name)]!;
    return [read("propose:votesMine"), read("propose:passesMine"), read("propose:dragonara:opensMine"), read("propose:horsard:opensMine"), read("propose:passesTheirsSeen")].join();
  };
  assert(ready(card("dragonara-b-2")) === "1,1,1,0,0", "A 9 convinces the whole low Dragonara Senate; the opponent's face-down 8 isn't seen");
  assert(ready(card("dragonara-b-2", true)) === "1,1,1,0,1", "The opponent's face-up 8 is seen to pass too");
}

// The shipped weights (the main evaluator and the Legacy & Diplomacy specialist) load, match
// PyTorch on their own cases, and say something sensible.
const shipped = (path: string) => readFileSync(new URL(`../../public${path}`, import.meta.url));
const bytes = shipped(EVALUATOR_PATH);
const net = loadNet(bytes);
const expansionNet = loadNet(shipped(EXPANSION_EVALUATOR_PATH));
for (const [path, weights] of [
  [EVALUATOR_PATH, net],
  [EXPANSION_EVALUATOR_PATH, expansionNet],
] as const) {
  const { featureVersion, cases } = JSON.parse(readFileSync(new URL(`../../public${path}.cases.json`, import.meta.url), "utf8")) as {
    featureVersion: string;
    cases: { sparse: number[]; dense: number[]; logit: number }[];
  };
  assert(featureVersion === FEATURE_VERSION, `${path}: the shipped cases use this feature layout`);
  let worst = 0;
  for (const entry of cases) worst = Math.max(worst, Math.abs(netLogit(weights, { sparse: entry.sparse, dense: Float32Array.from(entry.dense) }) - entry.logit));
  assert(cases.length >= 8 && worst < 1e-3, `${path}: TypeScript matches PyTorch on ${cases.length} positions (worst difference ${worst})`);

  const state = midGame(5, 60);
  const chances = [winChance(weights, state, 0), winChance(weights, state, 1)];
  assert(chances.every((chance) => chance > 0 && chance < 1), `${path}: win chances are probabilities`);
}

// Weights for another feature layout are refused.
{
  const text = new TextDecoder().decode(bytes.subarray(8, 8 + new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true)));
  const header = JSON.parse(text);
  const other = JSON.stringify({ ...header, featureVersion: "pax-features-0" });
  const padded = other + " ".repeat((4 - (other.length % 4)) % 4);
  const altered = new Uint8Array(8 + padded.length + (bytes.length - 8 - text.length));
  altered.set(bytes.subarray(0, 4));
  new DataView(altered.buffer).setUint32(4, padded.length, true);
  altered.set(new TextEncoder().encode(padded), 8);
  altered.set(bytes.subarray(8 + text.length), 8 + padded.length);
  let refused = false;
  try {
    loadNet(altered);
  } catch {
    refused = true;
  }
  assert(refused, "Weights trained on another feature layout are refused");
}

// The Ninth plays whole games with the shipped evaluators, legally: the base game with the main
// one, Legacy & Diplomacy with its specialist (which must have learned the expansion).
assert(expansionNet.header.expansion === true, "The Legacy & Diplomacy evaluator learned expansion games");
{
  let refused = false;
  try {
    setNinthEvaluator(net, { expansion: { ...expansionNet, header: { ...expansionNet.header, expansion: false } } });
  } catch {
    refused = true;
  }
  assert(refused, "A base-game evaluator is refused as the Legacy & Diplomacy specialist");
}
setNinthEvaluator(net, { expansion: expansionNet });
assert(ninthEvaluatorLoaded(), "The Ninth's evaluator is set");
for (const expansion of [false, true]) {
  const rng = createSeededRng(41);
  let replay = newReplay(41, { expansion });
  for (let i = 0; i < 2000 && !replay.state.victory; i++) {
    const actor = currentActor(replay.state);
    const action = chooseAiAction(replay.state, actor, actor === 0 ? "ninth" : "normal", rng);
    assert(action, `The Ninth's game (${expansion ? "expansion" : "base"}) step ${i}: no move`);
    replay = stepReplay(replay, action!); // throws if illegal
  }
  assert(replay.state.victory, `The Ninth finishes a ${expansion ? "Legacy & Diplomacy" : "base"} game`);
}
setNinthEvaluator(null);

report(`Evaluator ok: the encoding hides the opponent's face-down cards, knows inactive victories and the Ideological outlook, both shipped evaluators match PyTorch, other layouts are refused, and The Ninth finishes base and expansion games with them.`);
