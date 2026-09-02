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
  assert(state.executive === null, "Nobody holds executive power at start");
  assert(state.districtOrder.length === 4, "Need 4 districts");
  assert(
    new Set(state.districtOrder).size === 4,
    "District order must be a permutation",
  );
  for (const district of DISTRICTS) {
    assert(state.policy[district] === null, `${district} should start Neutral`);
  }

  const seat0 = state.players[0];
  const seat1 = state.players[1];
  const first = state.players[state.firstPlayer];
  const second = state.players[otherPlayer(state.firstPlayer)];
  assert(seat0.hand.length === 3, `Player 1 hand ${seat0.hand.length}, want 3`);
  assert(seat1.hand.length === 4, `Player 2 hand ${seat1.hand.length}, want 4`);
  assert(first.partyId !== null && second.partyId !== null, "Both parties chosen");
  assert(
    getParty(first.partyId).order < getParty(second.partyId).order,
    "Lower party order is first player",
  );

  const seat0OfferNames = getParty(seat0.partyId!).startingCards.map((c) => c.name);
  const seat0HandNames = seat0.hand.map((c) => getCard(c.cardId).name);
  assert(
    seat0HandNames.every((name) => seat0OfferNames.includes(name)),
    "Player 1 hand must come from the party list",
  );
  const seat1HandNames = seat1.hand.map((c) => getCard(c.cardId).name).sort();
  const seat1OfferNames = getParty(seat1.partyId!)
    .startingCards.map((c) => c.name)
    .sort();
  assert(
    JSON.stringify(seat1HandNames) === JSON.stringify(seat1OfferNames),
    "Player 2 takes all 4 listed cards",
  );

  const nonGeHands = [...seat0.hand, ...seat1.hand].filter(
    (c) => kindOf(c.cardId) !== CardKind.Election,
  );
  const nonGeMarket = state.market.filter((c) => kindOf(c.cardId) !== CardKind.Election);
  const nonGeDeck = state.deck.filter((c) => kindOf(c.cardId) !== CardKind.Election);
  assert(nonGeHands.length === 7, `Starting cards ${nonGeHands.length}, want 7`);
  assert(nonGeMarket.length === 5, `Market ${nonGeMarket.length}, want 5`);
  assert(nonGeDeck.length === 92, `Pile non-GE ${nonGeDeck.length}, want 92`);
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

{
  let found = false;
  for (let seed = 1; seed <= 80 && !found; seed++) {
    const rng = createSeededRng(seed);
    let state = createGame(rng, { seed });
    if (!state.setup!.dealtParties[0].includes(PartyId.Progressive)) continue;

    const rng2 = createSeededRng(seed);
    state = createGame(rng2, { seed });
    state = apply(state, {
      type: "chooseParty",
      player: 0,
      partyId: PartyId.Progressive,
    }, rng2).state;

    assert(state.setup?.step === "chooseStartingHand", "Player 1 starting cards come next");
    assert(state.activePlayer === 0, "Player 1 keeps the device for starting cards");
    const offer = state.setup!.startingOffers[0];
    const dg = offer.find((card) => getCard(card.cardId).name === "District Governor");
    assert(dg, "Progressive offer should include District Governor");
    const ids = [
      dg!.instanceId,
      ...offer
        .map((c) => c.instanceId)
        .filter((id) => id !== dg!.instanceId),
    ].slice(0, 3);

    state = apply(state, {
      type: "chooseStartingHand",
      player: 0,
      instanceIds: ids,
    }, rng2).state;

    assert(state.activePlayer === 1, "Pass to Player 2 after Player 1's starting cards");
    assert(state.setup?.step === "chooseParty", "Player 2 still chooses a party");

    const p1 = state.setup!.dealtParties[1][0]!;
    state = apply(state, {
      type: "chooseParty",
      player: 1,
      partyId: p1,
    }, rng2).state;

    assert(state.phase === "action", "Player 2's party choice should finish setup");
    assert(state.players[0].hand.length === 3, "Player 1 took 3 cards");
    assert(state.players[1].hand.length === 4, "Player 2 is dealt all 4 listed cards");

    try {
      apply(
        state,
        {
          type: "chooseStartingHand",
          player: 0,
          instanceIds: ids,
        },
        rng2,
      );
      fail("Player 1 should not take a starting hand twice");
    } catch (error) {
      if (!(error instanceof IllegalActionError)) {
        fail(`Wrong error for double starting hand: ${error}`);
      }
    }

    const isDragonaraGovernor = (cardId: string) => {
      const card = getCard(cardId);
      return (
        card.kind === CardKind.Alliance &&
        card.district === District.Dragonara &&
        card.name === "District Governor"
      );
    };
    const dgInHand = state.players[0].hand.filter((c) =>
      isDragonaraGovernor(c.cardId),
    );
    const dgElsewhere = [...state.market, ...state.deck].filter((c) =>
      isDragonaraGovernor(c.cardId),
    );
    assert(dgInHand.length === 1, "Exactly one District Governor in Player 1's starting hand");
    assert(dgElsewhere.length === 1, "The other District Governor stays in the supply");
    found = true;
  }
  assert(found, "Could not find a seed where Player 1 is dealt Progressive");
}

{
  const rng = createSeededRng(3);
  let state = createGame(rng, { seed: 3 });
  const p0 = state.setup!.dealtParties[0][0]!;
  state = apply(state, { type: "chooseParty", player: 0, partyId: p0 }, rng).state;
  try {
    apply(
      state,
      {
        type: "chooseStartingHand",
        player: 0,
        instanceIds: state.setup!.startingOffers[0]
          .slice(0, 2)
          .map((c) => c.instanceId),
      },
      rng,
    );
    fail("Player 1 taking 2 cards should be illegal");
  } catch (error) {
    if (!(error instanceof IllegalActionError)) {
      fail(`Wrong error for 2-card starting hand: ${error}`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log("Setup ok: Standard seed reaches turn 1 with 7+5+92 and printed A–E piles.");
