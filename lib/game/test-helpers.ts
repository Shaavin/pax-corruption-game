/** Shared helpers for the engine's plain-Node test scripts. */
import { getCard } from "../cards/catalog.ts";
import { CardKind, type PartyIdValue } from "../cards/schema.ts";
import { apply, IllegalActionError, legalActions } from "./engine.ts";
import { createSeededRng, type Rng } from "./rng.ts";
import { createGame } from "./setup.ts";
import type { Action, CardInstance, GameState, PlayerId } from "./types.ts";

const errors: string[] = [];

export function fail(message: string): void {
  errors.push(message);
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

/** Print failures and exit 1, or print the success line. */
export function report(okMessage: string): void {
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log(okMessage);
}

export function expectIllegal(run: () => unknown, label: string): void {
  try {
    run();
    fail(`${label} should have been illegal`);
  } catch (error) {
    if (!(error instanceof IllegalActionError)) {
      fail(`${label} threw ${error}`);
    }
  }
}

export function playToTurnOne(
  seed: number,
  pickParty: (player: PlayerId, dealt: PartyIdValue[]) => PartyIdValue = (_p, dealt) =>
    dealt[0]!,
): { state: GameState; rng: Rng } {
  const rng = createSeededRng(seed);
  let state = createGame(rng, { seed });
  while (state.phase === "setup") {
    const actor = state.activePlayer;
    const actions = legalActions(state, actor);
    assert(actions.length > 0, `No legal actions for player ${actor}`);
    let action: Action = actions[0]!;
    if (action.type === "chooseParty") {
      action = {
        type: "chooseParty",
        player: actor,
        partyId: pickParty(actor, state.setup!.dealtParties[actor]),
      };
    }
    state = apply(state, action, rng).state;
  }
  return { state, rng };
}

/** Remove `n` matching cards from anywhere in the deck. */
export function takeFromDeck(
  state: GameState,
  pred: (card: CardInstance) => boolean,
  n = 1,
): CardInstance[] {
  const found: CardInstance[] = [];
  state.deck = state.deck.filter((card) => {
    if (found.length < n && pred(card)) {
      found.push(card);
      return false;
    }
    return true;
  });
  assert(found.length === n, `Could not take ${n} cards from the deck`);
  return found;
}

/** Find a main-deck card by name anywhere a test might have left it, and pull it out. */
export function pullByName(state: GameState, name: string): CardInstance {
  const zones: CardInstance[][] = [
    state.deck,
    state.market,
    state.senate,
    ...state.players.map((seat) => seat.hand),
  ];
  for (const zone of zones) {
    const index = zone.findIndex((card) => getCard(card.cardId).name === name);
    if (index >= 0) return zone.splice(index, 1)[0]!;
  }
  throw new Error(`Card ${name} not found`);
}

export function isKind(card: CardInstance, kind: (typeof CardKind)[keyof typeof CardKind]) {
  return getCard(card.cardId).kind === kind;
}

/** Remove every General Election still in the deck (for long scripted turns). */
export function stripElections(state: GameState): CardInstance[] {
  const elections = state.deck.filter((card) => isKind(card, CardKind.Election));
  state.deck = state.deck.filter((card) => !isKind(card, CardKind.Election));
  return elections;
}

/**
 * Play one complete, plain turn for the active player: a civil if one is in hand
 * (else endAction / the first main action), pass Politics, take the first Market
 * card if offered.
 */
export function playPlainTurn(state: GameState, rng: Rng): GameState {
  const actor = state.activePlayer;
  const main = legalActions(state, actor);
  const action =
    main.find((entry) => entry.type === "playCivil") ??
    main.find((entry) => entry.type === "endAction") ??
    main[0]!;
  let next = apply(state, action, rng).state;
  if (next.phase === "politics") {
    next = apply(next, { type: "endPolitics", player: actor }, rng).state;
  }
  if (next.phase === "income") {
    next = apply(next, { type: "takeMarket", player: actor, instanceId: next.market[0]!.instanceId }, rng).state;
  }
  return next;
}
