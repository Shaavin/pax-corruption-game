import { getCard } from "../cards/catalog.ts";
import { CardKind, DISTRICTS, type PartyIdValue } from "../cards/schema.ts";
import { districtInfluence } from "./influence.ts";
import {
  apply,
  createGame,
  createSeededRng,
  IllegalActionError,
  legalActions,
  MARKET_SIZE,
  otherPlayer,
  type Action,
  type GameState,
  type PlayerId,
  type Rng,
} from "./index.ts";

const errors: string[] = [];

function fail(message: string) {
  errors.push(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function playToTurnOne(
  seed: number,
  pickParty: (
    player: PlayerId,
    dealt: PartyIdValue[],
  ) => PartyIdValue = (_p, dealt) => dealt[0]!,
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

function collectIds(state: GameState): string[] {
  const ids: string[] = [];
  const add = (cards: { instanceId: string }[]) => {
    for (const card of cards) ids.push(card.instanceId);
  };
  for (const player of state.players) {
    add(player.hand);
    add(player.policySupporters);
    add(player.consultativeOffice);
    add(player.monuments);
    for (const district of DISTRICTS) {
      add(player.tableau[district]);
      add(player.support[district]);
    }
  }
  add(state.market);
  add(state.deck);
  add(state.availableMonuments);
  add(state.monumentDeck);
  add(state.electionsOut);
  return ids;
}

function assertUniqueIds(state: GameState, label: string) {
  const ids = collectIds(state);
  assert(new Set(ids).size === ids.length, `Duplicate instance ids ${label}`);
}

function firstCivil(state: GameState, player: PlayerId) {
  return state.players[player].hand.find(
    (card) => getCard(card.cardId).kind === CardKind.Civil,
  );
}

function playOneTurn(state: GameState, rng: Rng): GameState {
  const actor = state.activePlayer;
  assert(state.phase === "action", `Expected action phase, got ${state.phase}`);
  const actions = legalActions(state, actor);
  const play =
    actions.find((action) => action.type === "playCivil") ??
    actions.find((action) => action.type === "playAlliance") ??
    actions.find((action) => action.type === "endAction");
  assert(play, `No playCivil/playAlliance/endAction for player ${actor}`);
  let next = apply(state, play, rng).state;
  if (next.phase === "politics") {
    next = apply(next, { type: "endPolitics", player: actor }, rng).state;
  }
  if (next.phase === "income") {
    assert(next.activePlayer === actor, "Income is still the acting player's turn");
    const marketActions = legalActions(next, actor);
    assert(
      marketActions.length === next.market.length,
      "Every market card should be takeable",
    );
    assert(marketActions[0], "Income with a market needs a takeMarket action");
    next = apply(next, marketActions[0]!, rng).state;
  }
  assert(next.phase === "action", `Turn should end in action, got ${next.phase}`);
  assert(next.activePlayer === otherPlayer(actor), "Turn should pass to the other player");
  assert(next.market.length === MARKET_SIZE || next.deck.length === 0, "Market replenishes to 5");
  return next;
}

function expectIllegal(run: () => unknown, label: string) {
  try {
    run();
    fail(`${label} should have been illegal`);
  } catch (error) {
    if (!(error instanceof IllegalActionError)) {
      fail(`${label} threw ${error}`);
    }
  }
}

function finishTurnAfterMain(
  state: GameState,
  rng: Rng,
  actor: PlayerId,
): GameState {
  let next = state;
  if (next.phase === "politics") {
    next = apply(next, { type: "endPolitics", player: actor }, rng).state;
  }
  if (next.phase === "income") {
    next = apply(next, {
      type: "takeMarket",
      player: actor,
      instanceId: next.market[0]!.instanceId,
    }, rng).state;
  }
  return next;
}

{
  const { state: start, rng } = playToTurnOne(20260902);
  const actor = start.activePlayer;
  const civil = firstCivil(start, actor);
  assert(civil, "First player should have a civil card to play");
  const def = getCard(civil.cardId);
  assert(def.kind === CardKind.Civil, "Need a civil card");
  const beforeInfluence = districtInfluence(
    start.players[actor].tableau[def.district],
    start.players[actor].support[def.district].length,
  );

  const legal = legalActions(start, actor);
  assert(
    legal.some(
      (action) => action.type === "playCivil" && action.instanceId === civil.instanceId,
    ),
    "Play civil should be listed",
  );
  assert(
    !legal.some((action) => action.type === "endAction"),
    "Cannot skip the action step while a civil is in hand",
  );

  const played = apply(start, {
    type: "playCivil",
    player: actor,
    instanceId: civil.instanceId,
  }, rng);
  let state = played.state;
  assert(
    played.events.some(
      (event) => event.type === "civilPlayed" && event.instanceId === civil.instanceId,
    ),
    "civilPlayed event",
  );
  assert(
    !state.players[actor].hand.some((card) => card.instanceId === civil.instanceId),
    "Played civil leaves the hand",
  );
  const inTableau = state.players[actor].tableau[def.district].find(
    (card) => card.instanceId === civil.instanceId,
  );
  assert(inTableau?.faceUp, "Played civil is face-up in its printed district");
  assert(inTableau?.occupiedDistrict === def.district, "occupiedDistrict matches print");

  const afterInfluence = districtInfluence(
    state.players[actor].tableau[def.district],
    state.players[actor].support[def.district].length,
  );
  assert(
    afterInfluence.civil === beforeInfluence.civil + def.influence,
    `Influence should rise by ${def.influence}, ${beforeInfluence.civil} → ${afterInfluence.civil}`,
  );
  assert(afterInfluence.support === 0, "Dummy play does not add support-pile cards");

  for (const district of DISTRICTS) {
    if (district === def.district) continue;
    assert(
      state.players[actor].tableau[district].length === 0,
      `Civil should not land in ${district}`,
    );
  }

  expectIllegal(
    () =>
      apply(start, {
        type: "endAction",
        player: actor,
      }, rng),
    "endAction while holding a civil",
  );

  const opponent = otherPlayer(actor);
  expectIllegal(
    () =>
      apply(start, {
        type: "playCivil",
        player: opponent,
        instanceId: civil.instanceId,
      }, rng),
    "Opponent playing during your action",
  );

  assert(state.phase === "politics", "Main action is followed by politics");
  assert(
    legalActions(state, actor).some((action) => action.type === "endPolitics"),
    "Politics can be skipped",
  );
  const beforeHand = state.players[actor].hand.length;
  const beforeDeck = state.deck.length;
  const marketId = state.market[0]!.instanceId;
  const afterPolitics = apply(state, { type: "endPolitics", player: actor }, rng);
  state = afterPolitics.state;

  if (state.phase === "income") {
    assert(state.activePlayer === actor, "Income belongs to the player who just acted");
    const taken = apply(state, {
      type: "takeMarket",
      player: actor,
      instanceId: marketId,
    }, rng);
    state = taken.state;
    assert(
      taken.events.some((event) => event.type === "marketTaken" && event.instanceId === marketId),
      "marketTaken event",
    );
    assert(
      state.players[actor].hand.some((card) => card.instanceId === marketId),
      "Taken market card goes to hand",
    );
    assert(
      state.players[actor].hand.find((card) => card.instanceId === marketId)?.faceUp,
      "A market take stays public in hand",
    );
    const drawn = taken.events.find((event) => event.type === "cardDrawn");
    if (drawn) {
      assert(
        state.players[actor].hand.some(
          (card) => card.cardId === drawn.cardId && !card.faceUp,
        ),
        "A deck draw stays hidden in hand",
      );
    }
    assert(
      !state.market.some((card) => card.instanceId === marketId),
      "Taken card leaves the market",
    );
    assert(state.market.length === MARKET_SIZE, "Market replenishes to 5");
    assert(state.players[actor].hand.length >= beforeHand, "Hand does not shrink during income");
    assert(state.deck.length < beforeDeck, "Deck supplies the draw and/or replenish");
    assert(state.phase === "action", "Income ends the turn");
    assert(state.activePlayer === opponent, "Pass to the other player after income");
  } else {
    assert(state.phase === "action", "Turn ended after income");
    assert(state.activePlayer === opponent, "Pass after a full-hand income");
  }

  assertUniqueIds(state, "after first civil + income");
}

{
  const { state: start, rng } = playToTurnOne(7);
  const actor = start.activePlayer;
  const alliance = start.players[actor].hand.find(
    (card) => getCard(card.cardId).kind === CardKind.Alliance,
  );
  if (alliance) {
    expectIllegal(
      () =>
        apply(start, {
          type: "playCivil",
          player: actor,
          instanceId: alliance.instanceId,
        }, rng),
      "Playing an alliance as civil",
    );
  }

  expectIllegal(
    () =>
      apply(start, {
        type: "takeMarket",
        player: actor,
        instanceId: start.market[0]!.instanceId,
      }, rng),
    "takeMarket during the action step",
  );

  expectIllegal(
    () =>
      apply(start, {
        type: "playCivil",
        player: actor,
        instanceId: "not-in-hand",
      }, rng),
    "Playing a card that is not in hand",
  );
}

{
  const { state: start, rng } = playToTurnOne(42);
  start.deck = start.deck.filter((card) => getCard(card.cardId).kind !== CardKind.Election);
  let state = start;
  for (let turn = 0; turn < 8; turn++) {
    const actor = state.activePlayer;
    const handBefore = state.players[actor].hand.length;
    state = playOneTurn(state, rng);
    const previous = otherPlayer(state.activePlayer);
    assert(
      state.players[previous].hand.length <= handBefore + 2,
      "Hand grows by at most a market take and a draw",
    );
    assert(
      state.players[previous].hand.length <= 5 || handBefore >= 5,
      "Income stops drawing at the hand limit",
    );
    assertUniqueIds(state, `dummy turn ${turn + 1}`);
  }

  const civilsOnBoard = DISTRICTS.reduce((count, district) => {
    return (
      count +
      state.players[0].tableau[district].filter(
        (card) => getCard(card.cardId).kind === CardKind.Civil,
      ).length +
      state.players[1].tableau[district].filter(
        (card) => getCard(card.cardId).kind === CardKind.Civil,
      ).length
    );
  }, 0);
  assert(civilsOnBoard >= 1, "A dummy game should put at least one civil on the table");
  assert(state.market.length === MARKET_SIZE, "Market stays at 5 after dummy turns");
  assert(state.electionsOut.every((card) => getCard(card.cardId).kind === CardKind.Election), "Only GEs are set aside");
}

{
  const { state: start, rng } = playToTurnOne(11);
  const actor = start.activePlayer;
  const civil = firstCivil(start, actor);
  assert(civil, "Need a civil to force a draw");
  const ge = start.deck.find((card) => getCard(card.cardId).kind === CardKind.Election);
  assert(ge, "Standard deck contains general elections");
  start.deck = [ge, ...start.deck.filter((card) => card.instanceId !== ge.instanceId)];
  const underLimitAfterPlay = start.players[actor].hand.length - 1 < start.players[actor].handLimit;
  assert(underLimitAfterPlay, "First-turn play should still draw");

  let state = apply(start, {
    type: "playCivil",
    player: actor,
    instanceId: civil.instanceId,
  }, rng).state;
  state = finishTurnAfterMain(state, rng, actor);
  assert(
    state.electionsOut.some((card) => card.instanceId === ge.instanceId),
    "Drawn general election is set aside",
  );
  assert(
    !state.players[actor].hand.some((card) => card.instanceId === ge.instanceId),
    "General election must not enter the hand",
  );
  assert(
    !state.market.some((card) => card.instanceId === ge.instanceId),
    "General election must not sit in the market",
  );
  assert(state.election.active, "A GE drawn during income starts an election after the turn");
  assert(state.activePlayer === otherPlayer(actor), "First election: the non-triggerer goes first");
  assertUniqueIds(state, "after GE set-aside");
}

{
  const { state: start, rng } = playToTurnOne(19);
  const actor = start.activePlayer;
  const seat = start.players[actor];
  const filler = start.deck.filter((card) => getCard(card.cardId).kind !== CardKind.Election);
  while (seat.hand.length < seat.handLimit && filler.length > 0) {
    const card = filler.shift()!;
    start.deck = start.deck.filter((entry) => entry.instanceId !== card.instanceId);
    seat.hand.push({ ...card, faceUp: true });
  }
  assert(seat.hand.length === seat.handLimit, "Fill the hand to the limit");
  const civil = firstCivil(start, actor);
  assert(civil, "Need a civil to play from a full hand");
  const deckBefore = start.deck.length;
  const marketBefore = start.market.map((card) => card.instanceId);

  let state = apply(start, {
    type: "playCivil",
    player: actor,
    instanceId: civil.instanceId,
  }, rng).state;
  assert(state.phase === "politics", "At 4 after play, politics comes before income");
  state = apply(state, { type: "endPolitics", player: actor }, rng).state;
  assert(state.phase === "income", "At 4 after play, income still takes a market card");
  state = apply(state, {
    type: "takeMarket",
    player: actor,
    instanceId: state.market[0]!.instanceId,
  }, rng).state;
  assert(state.players[actor].hand.length === seat.handLimit, "No deck draw at the hand limit");
  assert(state.deck.length === deckBefore - 1, "Only the market replenish comes from the deck");
  assert(state.market.length === MARKET_SIZE, "Replenish after taking");
  assert(
    marketBefore.every((id) => id === start.market[0]!.instanceId || state.market.some((c) => c.instanceId === id) || state.players[actor].hand.some((c) => c.instanceId === id)),
    "Market cards are accounted for",
  );
}

{
  const { state: start, rng } = playToTurnOne(23);
  const actor = start.activePlayer;
  start.players[actor].hand = [];
  const actions = legalActions(start, actor);
  assert(
    actions.length === 1 && actions[0]!.type === "endAction",
    "Empty hand → only endAction",
  );
  let state = apply(start, { type: "endAction", player: actor }, rng).state;
  state = finishTurnAfterMain(state, rng, actor);
  assert(state.phase === "action", "endAction still completes income");
  assert(state.activePlayer === otherPlayer(actor), "endAction passes the turn");
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log("Turn ok: play civil, income (take / draw / replenish), pass, GE starts election.");
