import { getCard } from "../cards/catalog.ts";
import { CardKind } from "../cards/schema.ts";
import { currentActor, legalActions } from "./engine.ts";
import { newReplay, parseImport, replayRecord, stepReplay, toRecord, encodeShareCode } from "./record.ts";
import { DRAW_PLANS, GAME_MODES, PILE_CARD_COUNT, pileSlices } from "./setup.ts";
import { GameMode, type GameModeId } from "./types.ts";
import { assert, report } from "./test-helpers.ts";

const isElection = (cardId: string) => getCard(cardId).kind === CardKind.Election;

/** Finish setup for a mode by taking the first legal action each time. */
function setUp(seed: number, mode: GameModeId) {
  let replay = newReplay(seed, mode);
  while (replay.state.phase === "setup") {
    replay = stepReplay(replay, legalActions(replay.state, currentActor(replay.state))[0]!);
  }
  return replay;
}

// Every plan is 87 cards + 4 General Elections.
for (const mode of Object.keys(DRAW_PLANS) as GameModeId[]) {
  const plan = DRAW_PLANS[mode];
  assert(plan.reduce((sum, pile) => sum + pile.cards, 0) === PILE_CARD_COUNT, `${mode}: 87 pile cards`);
  assert(plan.reduce((sum, pile) => sum + pile.elections, 0) === 4, `${mode}: 4 General Elections`);
  assert(GAME_MODES.some((entry) => entry.id === mode), `${mode}: listed for the menu`);
}

// Built decks match the printed piles, for several seeds per mode.
const fixedElectionIndexes: Partial<Record<GameModeId, number[]>> = {
  // "X + 1": the election sits at the bottom of its pile.
  [GameMode.Tourney]: [10, 33, 54, 73],
};
for (const mode of Object.keys(DRAW_PLANS) as GameModeId[]) {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { state } = setUp(seed, mode);
    assert(state.mode === mode, `${mode}: state records its mode`);
    assert(state.deck.length === PILE_CARD_COUNT + 4, `${mode}: deck is 91 cards`);
    for (const slice of pileSlices(mode)) {
      const pile = state.deck.slice(slice.start, slice.end);
      const ges = pile.filter((card) => isElection(card.cardId)).length;
      assert(ges === slice.elections, `${mode} seed ${seed}: pile ${slice.name} has ${ges} elections, want ${slice.elections}`);
      const plan = DRAW_PLANS[mode].find((entry) => entry.name === slice.name)!;
      if (plan.placement === "bottom" && plan.elections === 1) {
        assert(isElection(pile.at(-1)!.cardId), `${mode} seed ${seed}: pile ${slice.name} ends with its election`);
      }
    }
    const fixed = fixedElectionIndexes[mode];
    if (fixed) {
      const at = state.deck.flatMap((card, index) => (isElection(card.cardId) ? [index] : []));
      assert(JSON.stringify(at) === JSON.stringify(fixed), `${mode}: elections at ${at}, want ${fixed}`);
    }
  }
}

// Chaotic and Epic spot checks from the rulebook table.
{
  const chaotic = setUp(9, GameMode.Chaotic).state.deck;
  assert(isElection(chaotic[8]!.cardId), "Chaotic: the election closes pile A (8 + 1)");
  assert(chaotic.slice(9, 19).every((card) => !isElection(card.cardId)), "Chaotic: pile B (10) has no election");
  assert(chaotic.slice(19, 86).filter((card) => isElection(card.cardId)).length === 3, "Chaotic: C+D (64 & 3) hides 3");
  assert(chaotic.slice(86).every((card) => !isElection(card.cardId)), "Chaotic: pile E (5) has no election");
  const epic = setUp(9, GameMode.Epic).state.deck;
  assert(isElection(epic[4]!.cardId) && isElection(epic[25]!.cardId), "Epic: A (4 + 1) and B (20 + 1) end with elections");
  assert(epic.slice(26, 34).every((card) => !isElection(card.cardId)), "Epic: pile C (8) has no election");
}

// Standard is unchanged: a Standard record replays the same with or without the mode field.
{
  let replay = setUp(31, GameMode.Standard);
  for (let i = 0; i < 10; i++) replay = stepReplay(replay, legalActions(replay.state, currentActor(replay.state))[0]!);
  const record = toRecord(replay);
  assert(record.mode === undefined, "Standard records omit the mode");
  assert(JSON.stringify(replayRecord(record).state) === JSON.stringify(replay.state), "Standard record replays");
}

// Modes survive records and share codes.
{
  const replay = setUp(12, GameMode.Epic);
  const record = toRecord(replay);
  assert(record.mode === GameMode.Epic, "Epic records carry their mode");
  const back = parseImport(encodeShareCode(record));
  assert(back?.record.mode === GameMode.Epic, "Mode survives a share code");
  assert(JSON.stringify(replayRecord(back.record).state) === JSON.stringify(replay.state), "Epic record replays exactly");
  assert(parseImport(JSON.stringify({ ...record, mode: "bogus" })) === null, "Unknown modes are rejected");
}

report("Modes ok: Standard, Tourney, Chaotic, Epic piles; records and share codes keep the mode.");
