import { getCard, getParty } from "../cards/catalog.ts";
import { CardKind, DISTRICTS, District, PartyId, type PartyIdValue } from "../cards/schema.ts";
import {
  apply,
  createGame,
  createSeededRng,
  IllegalActionError,
  legalActions,
  otherPlayer,
  standardPileSlices,
  type Action,
  type GameState,
  type PlayerId,
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
): GameState {
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
  return state;
}

function collectIds(state: GameState): string[] {
  const ids: string[] = [];
  const add = (cards: { instanceId: string }[]) => {
    for (const card of cards) ids.push(card.instanceId);
  };
  for (const player of state.players) {
    add(player.hand);
    add(player.consultativeOffice);
    add(player.planetNextBank);
    add(player.monuments);
    for (const district of DISTRICTS) {
      add(player.tableau[district]);
      add(player.support[district]);
    }
  }
  add(state.senate);
  add(state.market);
  add(state.deck);
  add(state.availableMonuments);
  add(state.monumentDeck);
  add(state.electionsOut);
  if (state.setup) {
    add(state.setup.nonElectionPool);
    add(state.setup.electionCards);
  }
  return ids;
}

function kindOf(cardId: string) {
  return getCard(cardId).kind;
}

{
  const seed = 20260902;
  const state = playToTurnOne(seed);

  assert(state.phase === "action", `Expected action phase, got ${state.phase}`);
  assert(state.setup === null, "Setup should be cleared");
  assert(state.firstPlayer !== null, "First player should be set");
  assert(state.activePlayer === state.firstPlayer, "First player takes turn 1");
  assert(state.senate.length === 5, "Senate has 5 cards");
  assert(state.senate.every((c) => c.faceUp), "Senate is face-up");
  assert(
    state.senate.every((c) => kindOf(c.cardId) !== CardKind.Election),
    "Senate must not contain general elections",
  );
  assert(
    state.decrees.length === 4 && state.decrees.every((d) => !d.active),
    "Four decree objectives start inactive",
  );
  assert(state.districtOrder.length === 4, "Need 4 districts");
  assert(
    new Set(state.districtOrder).size === 4,
    "District order must be a permutation",
  );
  for (const district of DISTRICTS) {
    assert(state.policy[district] === null, `${district} should start Neutral`);
  }

  const first = state.players[state.firstPlayer];
  const second = state.players[otherPlayer(state.firstPlayer)];
  const seat0 = first;
  const seat1 = second;
  assert(first.hand.length === 3, `First player hand ${first.hand.length}, want 3`);
  assert(second.hand.length === 4, `Second player hand ${second.hand.length}, want 4`);
  assert(
    [...seat0.hand, ...seat1.hand].every((card) => !card.faceUp),
    "Starting hands are secret",
  );
  assert(first.partyId !== null && second.partyId !== null, "Both parties chosen");
  assert(
    getParty(first.partyId).order < getParty(second.partyId).order,
    "Lower party order is first player",
  );

  const seat0OfferNames = getParty(seat0.partyId!).startingCards.map((c) => c.name);
  const seat0HandNames = seat0.hand.map((c) => getCard(c.cardId).name);
  assert(
    seat0HandNames.every((name) => seat0OfferNames.includes(name)),
    "First player's hand must come from their party list",
  );
  const seat1HandNames = seat1.hand.map((c) => getCard(c.cardId).name).sort();
  const seat1OfferNames = getParty(seat1.partyId!)
    .startingCards.map((c) => c.name)
    .sort();
  assert(
    JSON.stringify(seat1HandNames) === JSON.stringify(seat1OfferNames),
    "Second player takes all 4 listed cards",
  );

  const nonGeHands = [...seat0.hand, ...seat1.hand].filter(
    (c) => kindOf(c.cardId) !== CardKind.Election,
  );
  const nonGeMarket = state.market.filter((c) => kindOf(c.cardId) !== CardKind.Election);
  const nonGeDeck = state.deck.filter((c) => kindOf(c.cardId) !== CardKind.Election);
  assert(nonGeHands.length === 7, `Starting cards ${nonGeHands.length}, want 7`);
  assert(nonGeMarket.length === 5, `Market ${nonGeMarket.length}, want 5`);
  assert(nonGeDeck.length === 87, `Pile non-GE ${nonGeDeck.length}, want 87`);
  assert(state.market.length === 5, "Market is 5 cards");
  assert(
    state.market.every((c) => kindOf(c.cardId) !== CardKind.Election),
    "Market must not contain general elections",
  );
  assert(state.market.every((c) => c.faceUp), "Market is face-up");

  const geInDeck = state.deck.filter((c) => kindOf(c.cardId) === CardKind.Election);
  assert(geInDeck.length === 4, `Deck GE count ${geInDeck.length}, want 4`);
  assert(state.electionsOut.length === 0, "No elections out at start");

  const slices = standardPileSlices();
  const last = slices[slices.length - 1]!;
  assert(last.end === state.deck.length, "Pile slices should cover the deck");
  for (const slice of slices) {
    const pile = state.deck.slice(slice.start, slice.end);
    const ge = pile.filter((c) => kindOf(c.cardId) === CardKind.Election).length;
    assert(
      ge === slice.elections,
      `Pile ${slice.name} GE count ${ge}, want ${slice.elections}`,
    );
  }

  const startingIds = new Set([...seat0.hand, ...seat1.hand].map((c) => c.instanceId));
  assert(
    state.market.every((c) => !startingIds.has(c.instanceId)),
    "Starting cards must not be in the market",
  );
  assert(
    state.senate.every((c) => !startingIds.has(c.instanceId)),
    "Starting cards must not be in the Senate",
  );
  assert(
    state.deck.every((c) => !startingIds.has(c.instanceId)),
    "Starting cards must not remain in the deck",
  );

  const guaranteed = [
    getParty(first.partyId).guaranteedMonumentId,
    getParty(second.partyId).guaranteedMonumentId,
  ];
  const available = state.availableMonuments.map((c) => c.cardId);
  assert(available.length === 4, "Four monuments available");
  assert(state.monumentDeck.length === 4, "Four monuments in the monument deck");
  assert(
    guaranteed.every((id) => available.includes(id)),
    "Guaranteed party monuments must be available",
  );
  const monumentIds = [...available, ...state.monumentDeck.map((c) => c.cardId)];
  assert(new Set(monumentIds).size === 8, "All 8 monuments accounted for");
  assert(state.unusedParties.length === 6, "Six unused parties leave the game");
  assert(!state.unusedParties.includes(first.partyId), "Chosen party is not unused");
  assert(!state.unusedParties.includes(second.partyId), "Chosen party is not unused");

  const ids = collectIds(state);
  assert(new Set(ids).size === ids.length, "Duplicate instance ids after setup");
}

{
  const seed = 99;
  const a = playToTurnOne(seed);
  const b = playToTurnOne(seed);
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    "Same seed and choices must replay identically",
  );
}

{
  const rng = createSeededRng(7);
  const state = createGame(rng, { seed: 7 });
  try {
    apply(
      state,
      { type: "chooseParty", player: 0, partyId: PartyId.Trinity },
      rng,
    );
    if (!state.setup!.dealtParties[0].includes(PartyId.Trinity)) {
      fail("Expected illegal party choice to throw");
    }
  } catch (error) {
    if (!(error instanceof IllegalActionError)) {
      fail(`Wrong error for illegal party: ${error}`);
    }
  }

  const dealt = state.setup!.dealtParties[0][0]!;
  try {
    apply(state, { type: "chooseParty", player: 1, partyId: dealt }, rng);
    fail("Opponent should not choose during player 0 party step");
  } catch (error) {
    if (!(error instanceof IllegalActionError)) {
      fail(`Wrong error for out-of-turn party: ${error}`);
    }
  }
}

// Both parties are chosen first; then the lower party number keeps 3 of 4.
// Cover both seats being the first player.
{
  const seen = new Set<PlayerId>();
  for (let seed = 1; seed <= 200 && seen.size < 2; seed++) {
    const rng = createSeededRng(seed);
    let state = createGame(rng, { seed });
    const p0 = state.setup!.dealtParties[0][0]!;
    const p1 = state.setup!.dealtParties[1][0]!;
    const firstSeat: PlayerId = getParty(p0).order < getParty(p1).order ? 0 : 1;
    if (seen.has(firstSeat)) continue;
    seen.add(firstSeat);

    state = apply(state, { type: "chooseParty", player: 0, partyId: p0 }, rng).state;
    assert(state.setup?.step === "chooseParty" && state.activePlayer === 1, "Seat 2 chooses a party next");
    assert(state.players[0].hand.length === 0, "No starting cards before both parties are chosen");
    state = apply(state, { type: "chooseParty", player: 1, partyId: p1 }, rng).state;

    assert(state.firstPlayer === firstSeat, "Lower party number is the first player");
    assert(state.setup?.step === "chooseStartingHand", "Then the first player picks starting cards");
    assert(state.activePlayer === firstSeat, "…on the first player's turn, whichever seat that is");
    const secondSeat: PlayerId = firstSeat === 0 ? 1 : 0;
    assert(state.players[secondSeat].hand.length === 4, "The second player already holds all 4");

    const offer = state.setup!.startingOffers[firstSeat];
    try {
      apply(state, { type: "chooseStartingHand", player: secondSeat, instanceIds: offer.slice(0, 3).map((c) => c.instanceId) }, rng);
      fail("The second player must not pick starting cards");
    } catch (error) {
      if (!(error instanceof IllegalActionError)) fail(`Wrong error for second-player pick: ${error}`);
    }
    try {
      apply(state, { type: "chooseStartingHand", player: firstSeat, instanceIds: offer.slice(0, 2).map((c) => c.instanceId) }, rng);
      fail("Taking only 2 cards should be illegal");
    } catch (error) {
      if (!(error instanceof IllegalActionError)) fail(`Wrong error for 2-card starting hand: ${error}`);
    }

    const left = offer[3]!;
    state = apply(state, {
      type: "chooseStartingHand",
      player: firstSeat,
      instanceIds: offer.slice(0, 3).map((c) => c.instanceId),
    }, rng).state;
    assert(state.phase === "action" && state.activePlayer === firstSeat, "Setup finishes; the first player starts");
    assert(state.players[firstSeat].hand.length === 3, "First player kept 3");
    assert(
      [...state.deck, ...state.market, ...state.senate].some((c) => c.instanceId === left.instanceId),
      "The left-out card goes back into the supply",
    );
  }
  assert(seen.size === 2, "Found setups where each seat is the first player");
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log("Setup ok: Standard seed reaches turn 1 with 7 + 5 Senate + 5 Market + 87 and printed A–E piles.");
