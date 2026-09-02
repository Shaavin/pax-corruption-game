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

  const first = state.players[state.firstPlayer];
  const second = state.players[otherPlayer(state.firstPlayer)];
  assert(first.hand.length === 3, `First player hand ${first.hand.length}, want 3`);
  assert(second.hand.length === 4, `Second player hand ${second.hand.length}, want 4`);
  assert(first.partyId !== null && second.partyId !== null, "Both parties chosen");
  assert(
    getParty(first.partyId).order < getParty(second.partyId).order,
    "Lower party order is first player",
  );

  const firstOfferNames = getParty(first.partyId).startingCards.map((c) => c.name);
  const firstHandNames = first.hand.map((c) => getCard(c.cardId).name);
  assert(
    firstHandNames.every((name) => firstOfferNames.includes(name)),
    "First player hand must come from the party list",
  );
  const secondHandNames = second.hand.map((c) => getCard(c.cardId).name).sort();
  const secondOfferNames = getParty(second.partyId)
    .startingCards.map((c) => c.name)
    .sort();
  assert(
    JSON.stringify(secondHandNames) === JSON.stringify(secondOfferNames),
    "Second player takes all 4 listed cards",
  );

  const nonGeHands = [...first.hand, ...second.hand].filter(
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

  const startingIds = new Set([...first.hand, ...second.hand].map((c) => c.instanceId));
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
    const progressiveHolder = ([0, 1] as const).find((player) =>
      state.setup!.dealtParties[player].includes(PartyId.Progressive),
    );
    if (progressiveHolder === undefined) continue;

    const other = otherPlayer(progressiveHolder);
    const otherDealt = state.setup!.dealtParties[other];
    const higher = otherDealt
      .map((id) => getParty(id))
      .find((party) => party.order > 3);
    if (!higher) continue;

    const pickParty = (player: PlayerId, _dealt: PartyIdValue[]) => {
      if (player === progressiveHolder) return PartyId.Progressive;
      return higher.id;
    };

    const rng2 = createSeededRng(seed);
    state = createGame(rng2, { seed });
    state = apply(state, {
      type: "chooseParty",
      player: 0,
      partyId: pickParty(0, state.setup!.dealtParties[0]),
    }, rng2).state;
    state = apply(state, {
      type: "chooseParty",
      player: 1,
      partyId: pickParty(1, state.setup!.dealtParties[1]),
    }, rng2).state;

    assert(state.firstPlayer === progressiveHolder, "Progressive should be first");
    const offer = state.setup!.startingOffers[progressiveHolder];
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
      player: progressiveHolder,
      instanceIds: ids,
    }, rng2).state;

    try {
      apply(
        state,
        {
          type: "chooseStartingHand",
          player: progressiveHolder,
          instanceIds: ids,
        },
        rng2,
      );
      fail("First player should not take a starting hand twice");
    } catch (error) {
      if (!(error instanceof IllegalActionError)) {
        fail(`Wrong error for double starting hand: ${error}`);
      }
    }

    const second = otherPlayer(progressiveHolder);
    const take4 = state.setup!.startingOffers[second].map((c) => c.instanceId);
    try {
      apply(
        state,
        { type: "chooseStartingHand", player: second, instanceIds: take4.slice(0, 3) },
        rng2,
      );
      fail("Second player must not take only 3");
    } catch (error) {
      if (!(error instanceof IllegalActionError)) {
        fail(`Wrong error for second-player 3 cards: ${error}`);
      }
    }

    state = apply(state, {
      type: "chooseStartingHand",
      player: second,
      instanceIds: take4,
    }, rng2).state;

    const isDragonaraGovernor = (cardId: string) => {
      const card = getCard(cardId);
      return (
        card.kind === CardKind.Alliance &&
        card.district === District.Dragonara &&
        card.name === "District Governor"
      );
    };
    const dgInHand = state.players[progressiveHolder].hand.filter((c) =>
      isDragonaraGovernor(c.cardId),
    );
    const dgElsewhere = [...state.market, ...state.deck].filter((c) =>
      isDragonaraGovernor(c.cardId),
    );
    assert(dgInHand.length === 1, "Exactly one District Governor in the starting hand");
    assert(dgElsewhere.length === 1, "The other District Governor stays in the supply");
    found = true;
  }
  assert(found, "Could not find a seed where Progressive is first player");
}

{
  const rng = createSeededRng(3);
  let state = createGame(rng, { seed: 3 });
  const p0 = state.setup!.dealtParties[0][0]!;
  state = apply(state, { type: "chooseParty", player: 0, partyId: p0 }, rng).state;
  const p1 = state.setup!.dealtParties[1][0]!;
  state = apply(state, { type: "chooseParty", player: 1, partyId: p1 }, rng).state;
  const first = state.firstPlayer!;
  try {
    apply(
      state,
      {
        type: "chooseStartingHand",
        player: first,
        instanceIds: state.setup!.startingOffers[first]
          .slice(0, 2)
          .map((c) => c.instanceId),
      },
      rng,
    );
    fail("First player taking 2 cards should be illegal");
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
