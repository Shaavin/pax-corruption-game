import { getCard } from "../cards/catalog.ts";
import {
  CardKind,
  DISTRICTS,
  MonumentId,
  PartyId,
  PolicyId,
  type PartyIdValue,
} from "../cards/schema.ts";
import { districtInfluence } from "./influence.ts";
import {
  apply,
  checkVictory,
  createGame,
  createSeededRng,
  IllegalActionError,
  legalActions,
  otherPlayer,
  printedDistrict,
  VictoryKind,
  type Action,
  type CardInstance,
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

function takeFromDeck(
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

{
  const { state: start, rng } = playToTurnOne(101);
  const actor = start.activePlayer;
  const alliance = start.players[actor].hand.find(
    (card) => getCard(card.cardId).kind === CardKind.Alliance,
  ) ?? takeFromDeck(start, (card) => getCard(card.cardId).kind === CardKind.Alliance)[0]!;
  if (!start.players[actor].hand.some((card) => card.instanceId === alliance.instanceId)) {
    start.players[actor].hand.push(alliance);
  }
  const def = getCard(alliance.cardId);
  assert(def.kind === CardKind.Alliance, "Need an alliance");
  const district = printedDistrict(alliance.cardId);

  const played = apply(start, {
    type: "playAlliance",
    player: actor,
    instanceId: alliance.instanceId,
  }, rng);
  const state = played.state;
  assert(
    played.events.some(
      (event) => event.type === "alliancePlayed" && event.instanceId === alliance.instanceId,
    ),
    "alliancePlayed event",
  );
  const inTableau = state.players[actor].tableau[district].find(
    (card) => card.instanceId === alliance.instanceId,
  );
  assert(inTableau?.faceUp, "Alliance is face-up in its district");
  const influence = districtInfluence(
    state.players[actor].tableau[district],
    state.players[actor].support[district].length,
  );
  assert(influence.civil === 0, "Alliances do not add district influence");
  assert(state.phase === "politics", "Alliance play is a main action");
}

{
  const { state: start, rng } = playToTurnOne(111);
  const actor = start.activePlayer;
  const first = takeFromDeck(start, (card) => getCard(card.cardId).kind === CardKind.Alliance)[0]!;
  const district = printedDistrict(first.cardId);
  const second = takeFromDeck(
    start,
    (card) =>
      getCard(card.cardId).kind === CardKind.Alliance &&
      printedDistrict(card.cardId) === district,
  )[0]!;
  start.players[actor].tableau[district] = [
    { ...first, faceUp: true, occupiedDistrict: district },
  ];
  start.players[actor].hand = [second];
  expectIllegal(
    () =>
      apply(start, {
        type: "playAlliance",
        player: actor,
        instanceId: second.instanceId,
      }, rng),
    "Second alliance in the same district",
  );
}

{
  const { state: start, rng } = playToTurnOne(202);
  const actor = start.activePlayer;
  const opponent = otherPlayer(actor);
  const district = DISTRICTS[0]!;
  const conspiracy = takeFromDeck(
    start,
    (card) =>
      getCard(card.cardId).kind === CardKind.Conspiracy &&
      printedDistrict(card.cardId) === district,
  )[0]!;
  const yourCivil = takeFromDeck(
    start,
    (card) =>
      getCard(card.cardId).kind === CardKind.Civil &&
      printedDistrict(card.cardId) === district,
  )[0]!;
  const theirAlliance = takeFromDeck(
    start,
    (card) =>
      getCard(card.cardId).kind === CardKind.Alliance &&
      printedDistrict(card.cardId) === district,
  )[0]!;
  start.players[actor].hand = [conspiracy];
  start.players[actor].tableau[district] = [
    { ...yourCivil, faceUp: true, occupiedDistrict: district },
  ];
  start.players[opponent].tableau[district] = [
    { ...theirAlliance, faceUp: true, occupiedDistrict: district },
  ];

  const result = apply(start, {
    type: "playConspiracy",
    player: actor,
    instanceId: conspiracy.instanceId,
  }, rng);
  const state = result.state;
  assert(
    result.events.some((event) => event.type === "conspiracyPlayed"),
    "conspiracyPlayed event",
  );
  assert(
    state.players[actor].tableau[district].length === 0 &&
      state.players[opponent].tableau[district].length === 0,
    "Both tableaus in the district are wiped",
  );
  assert(
    state.players[actor].support[district].some((card) => card.instanceId === yourCivil.instanceId),
    "Your wiped civil goes to your support",
  );
  assert(
    state.players[opponent].support[district].some(
      (card) => card.instanceId === theirAlliance.instanceId,
    ),
    "Opponent wiped alliance goes to their support",
  );
  assert(
    state.players[actor].support[district].some(
      (card) => card.instanceId === conspiracy.instanceId,
    ),
    "Conspiracy discards to the owner's pile",
  );
  assert(state.currentTurn.discarded, "A conspiracy counts as discarding this turn");
}

{
  const { state: start, rng } = playToTurnOne(303);
  const actor = start.activePlayer;
  const playable = start.players[actor].hand.find((card) => {
    const kind = getCard(card.cardId).kind;
    return kind === CardKind.Civil || kind === CardKind.Alliance || kind === CardKind.Conspiracy;
  });
  assert(playable, "Need a card to play into politics");
  const kind = getCard(playable.cardId).kind;
  const play: Action =
    kind === CardKind.Alliance
      ? { type: "playAlliance", player: actor, instanceId: playable.instanceId }
      : kind === CardKind.Conspiracy
        ? { type: "playConspiracy", player: actor, instanceId: playable.instanceId }
        : { type: "playCivil", player: actor, instanceId: playable.instanceId };
  let state = apply(start, play, rng).state;
  if (state.phase === "politics") {
    const tuck = state.players[actor].hand[0];
    assert(tuck, "Need a card left to campaign");
    const tucked = apply(state, {
      type: "campaign",
      player: actor,
      instanceId: tuck.instanceId,
    }, rng);
    state = tucked.state;
    assert(
      tucked.events.some((event) => event.type === "campaignTucked"),
      "campaignTucked event",
    );
    const supporter = state.players[actor].policySupporters.find(
      (entry) => entry.instanceId === tuck.instanceId,
    );
    assert(supporter && !supporter.faceUp, "Campaign tucks face-down");
    assert(state.players[actor].policySupporters.length === 1, "Supporter count is 1");
    assert(
      state.phase === "income" || state.phase === "action",
      "Campaign ends politics when nothing else is left",
    );
    if (state.players[actor].hand[0]) {
      expectIllegal(
        () =>
          apply(state, {
            type: "campaign",
            player: actor,
            instanceId: state.players[actor].hand[0]!.instanceId,
          }, rng),
        "Second campaign in the same politics step",
      );
    }
  } else {
    fail(`Expected politics after a main action, got ${state.phase}`);
  }
}

{
  const { state: start, rng } = playToTurnOne(404);
  const actor = start.activePlayer;
  const district = DISTRICTS[0]!;
  const spent = takeFromDeck(
    start,
    (card) =>
      getCard(card.cardId).kind !== CardKind.Election &&
      printedDistrict(card.cardId) === district,
    3,
  );
  start.players[actor].hand = spent;
  start.players[actor].partisans = 2;
  const result = apply(start, {
    type: "recruit",
    player: actor,
    instanceIds: spent.map((card) => card.instanceId),
  }, rng);
  const state = result.state;
  assert(result.events.some((event) => event.type === "partisansRecruited"), "recruited");
  assert(state.players[actor].partisans === 3, "Partisan count is 3");
  assert(
    spent.every((card) =>
      state.players[actor].support[district].some((entry) => entry.instanceId === card.instanceId),
    ),
    "Recruit discards to the matching support pile",
  );
  assert(state.victory?.kind === VictoryKind.Military, "Military at exactly 3 partisan difference");
  assert(state.victory?.player === actor, "Recruiter wins Military");
  assert(state.phase === "gameOver", "Military ends the game immediately");
}

{
  const { state: start, rng } = playToTurnOne(505);
  const actor = start.activePlayer;
  const district = DISTRICTS.find((id) =>
    start.availableMonuments.some((entry) => printedDistrict(entry.cardId) === id),
  );
  assert(district, "An available monument has a district");
  const monument = start.availableMonuments.find(
    (entry) => printedDistrict(entry.cardId) === district,
  )!;
  const spent = takeFromDeck(
    start,
    (card) =>
      getCard(card.cardId).kind !== CardKind.Election &&
      printedDistrict(card.cardId) === district,
    5,
  );
  start.players[actor].hand = spent;
  const beforeAvailable = start.availableMonuments.length;
  const beforeDeck = start.monumentDeck.length;
  const result = apply(start, {
    type: "construct",
    player: actor,
    instanceIds: spent.map((card) => card.instanceId),
    monumentInstanceId: monument.instanceId,
  }, rng);
  const state = result.state;
  assert(
    result.events.some(
      (event) => event.type === "monumentConstructed" && event.instanceId === monument.instanceId,
    ),
    "monumentConstructed",
  );
  assert(
    state.players[actor].monuments.some((entry) => entry.instanceId === monument.instanceId),
    "Monument sits by the party",
  );
  assert(
    !state.availableMonuments.some((entry) => entry.instanceId === monument.instanceId),
    "Claimed monument leaves the row",
  );
  if (beforeDeck > 0) {
    assert(state.availableMonuments.length === beforeAvailable, "Row replenishes to 4");
    assert(state.monumentDeck.length === beforeDeck - 1, "Replacement comes from the monument deck");
    assert(
      result.events.some((event) => event.type === "monumentReplenished"),
      "monumentReplenished event",
    );
  }
  assert(
    spent.every((card) =>
      state.players[actor].support[district].some((entry) => entry.instanceId === card.instanceId),
    ),
    "Construct discards 5 to support",
  );
}

{
  const { state: start, rng } = playToTurnOne(606);
  const actor = start.activePlayer;
  const district = DISTRICTS[1]!;
  const extras = takeFromDeck(
    start,
    (card) => getCard(card.cardId).kind !== CardKind.Election,
    8,
  );
  start.players[actor].support[district] = extras.map((card) => ({
    ...card,
    faceUp: true,
    occupiedDistrict: district,
  }));
  const conspiracy = takeFromDeck(
    start,
    (card) =>
      getCard(card.cardId).kind === CardKind.Conspiracy &&
      printedDistrict(card.cardId) === district,
  )[0]!;
  start.players[actor].hand = [conspiracy];
  const state = apply(start, {
    type: "playConspiracy",
    player: actor,
    instanceId: conspiracy.instanceId,
  }, rng).state;
  assert(state.players[actor].support[district].length === 9, "Pile is exactly 9");
  assert(state.victory?.kind === VictoryKind.Popularity, "Popularity at exactly 9 difference");
  assert(state.victory?.district === district, "Popularity names the district");
}

{
  const { state: start, rng } = playToTurnOne(707);
  const actor = start.activePlayer;
  const district = start.districtOrder[0]!;
  const tucked = takeFromDeck(
    start,
    (card) => {
      const def = getCard(card.cardId);
      return def.kind !== CardKind.Election && printedDistrict(card.cardId) === district;
    },
    3,
  );
  const cost = takeFromDeck(
    start,
    (card) =>
      getCard(card.cardId).kind !== CardKind.Election &&
      printedDistrict(card.cardId) === DISTRICTS.find((id) => id !== district)!,
    2,
  );
  start.players[actor].policySupporters = tucked.map((card) => ({ ...card, faceUp: false }));
  start.players[actor].hand = cost;
  const called = apply(start, {
    type: "callReferendum",
    player: actor,
    instanceIds: cost.map((card) => card.instanceId),
  }, rng);
  let state = called.state;
  assert(called.events.some((event) => event.type === "referendumStarted"), "referendum started");
  assert(state.referendum?.awaitingChoice, "Winner must choose a policy from Neutral");
  const choice = legalActions(state, state.referendum.chooser).find(
    (action) => action.type === "choosePolicy" && action.policyId !== null,
  );
  assert(choice && choice.type === "choosePolicy", "A printed side is offered from Neutral");
  const chosenDistrict = choice.district;
  state = apply(state, choice, rng).state;
  assert(state.policy[chosenDistrict] === choice.policyId, "Policy changes to the chosen side");
  assert(
    state.players[actor].policySupporters.length === 0,
    "Revealed supporters are discarded",
  );
  assert(state.phase === "politics" || state.phase === "gameOver", "Referendum is the main action");
}

{
  const { state } = playToTurnOne(808);
  state.players[0].partyId = PartyId.Trinity;
  state.players[1].partyId = PartyId.Liberal;
  state.players[0].monuments = [
    { instanceId: MonumentId.RomanBasilica, cardId: MonumentId.RomanBasilica, faceUp: true },
  ];
  state.policy.horsard = PolicyId.HorsardB;
  state.policy.shavvinne = PolicyId.ShavvinneA;
  const win = checkVictory(state);
  assert(win?.kind === VictoryKind.Ideological, "Ideological from party + monument + shared policies");
  assert(win?.player === 0, "Owner of extra symbols wins");
  assert(win?.symbol === "crown", "Four crowns");

  state.players[1].partyId = PartyId.Conservative;
  state.players[1].monuments = [
    { instanceId: MonumentId.SmartDoctrine, cardId: MonumentId.SmartDoctrine, faceUp: true },
  ];
  assert(checkVictory(state) === null, "Blocked when both have 4 of the same type");
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(
  "Actions ok: alliance, conspiracy, campaign, recruit/military, construct, referendum, popularity, ideological.",
);
