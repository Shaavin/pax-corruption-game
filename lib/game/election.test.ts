import { getCard } from "../cards/catalog.ts";
import {
  CardKind,
  DISTRICTS,
  ExecutiveSide,
  PolicyId,
  type DistrictId,
  type PartyIdValue,
} from "../cards/schema.ts";
import {
  apply,
  canUseEmergencyState,
  canUseLegalReview,
  createGame,
  createSeededRng,
  ELECTION_MARKET_SIZE,
  ElectionTieBreak,
  IllegalActionError,
  legalActions,
  MARKET_SIZE,
  otherPlayer,
  RECRUIT_COST,
  tallyElection,
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

function takeGe(state: GameState): CardInstance {
  const ge = state.deck.find((card) => getCard(card.cardId).kind === CardKind.Election);
  assert(ge, "Need a general election in the deck");
  state.deck = state.deck.filter((card) => card.instanceId !== ge.instanceId);
  return ge;
}

function firstCivil(state: GameState, player: PlayerId) {
  return state.players[player].hand.find((card) => getCard(card.cardId).kind === CardKind.Civil);
}

function playMain(state: GameState, rng: Rng, player: PlayerId): GameState {
  const card = firstCivil(state, player);
  if (card) {
    return apply(state, { type: "playCivil", player, instanceId: card.instanceId }, rng).state;
  }
  const actions = legalActions(state, player);
  const play = actions.find((action) => action.type === "playAlliance") ?? actions.find((action) => action.type === "endAction");
  assert(play, `No safe main action for player ${player}`);
  return apply(state, play, rng).state;
}

function finishTurnAfterMain(state: GameState, rng: Rng, actor: PlayerId): GameState {
  let next = state;
  if (next.phase === "politics") {
    next = apply(next, { type: "endPolitics", player: actor }, rng).state;
  }
  if (next.phase === "income") {
    next = apply(
      next,
      { type: "takeMarket", player: actor, instanceId: next.market[0]!.instanceId },
      rng,
    ).state;
  }
  return next;
}

function playTurn(state: GameState, rng: Rng): GameState {
  const actor = state.activePlayer;
  return finishTurnAfterMain(playMain(state, rng, actor), rng, actor);
}

function giveDistrictLead(state: GameState, player: PlayerId): void {
  for (const district of DISTRICTS) {
    const [card] = takeFromDeck(
      state,
      (entry) =>
        getCard(entry.cardId).kind === CardKind.Civil &&
        "district" in getCard(entry.cardId) &&
        getCard(entry.cardId).kind === CardKind.Civil &&
        (getCard(entry.cardId) as { district: DistrictId }).district === district,
    );
    state.players[player].tableau[district].push({
      ...card,
      faceUp: true,
      occupiedDistrict: district,
    });
  }
}

function shrinkMarket(state: GameState, keep: number): void {
  const extra = state.market.splice(keep);
  state.deck.push(...extra);
}

function triggerFirstElection(
  seed: number,
): { state: GameState; rng: Rng; triggerer: PlayerId } {
  const { state: start, rng } = playToTurnOne(seed);
  const triggerer = start.activePlayer;
  start.deck = [takeGe(start), ...start.deck];
  assert(firstCivil(start, triggerer) || legalActions(start, triggerer).length > 0, "Need a main action");
  let state = playMain(start, rng, triggerer);
  state = finishTurnAfterMain(state, rng, triggerer);
  return { state, rng, triggerer };
}

function resolveElectionToEnd(
  state: GameState,
  rng: Rng,
  winner: PlayerId,
): GameState {
  giveDistrictLead(state, winner);
  shrinkMarket(state, 1);
  let next = state;
  while (next.election.active && next.phase === "action") {
    next = playTurn(next, rng);
  }
  return next;
}

function chooseExecutive(state: GameState, rng: Rng) {
  assert(state.phase === "electionEnd", `Expected electionEnd, got ${state.phase}`);
  return apply(state, {
    type: "chooseExecutiveSide",
    player: state.activePlayer,
    side: ExecutiveSide.EmergencyState,
  }, rng);
}

{
  const empty = playToTurnOne(501).state;
  const tally = tallyElection(empty);
  assert(tally.winner === empty.firstPlayer, "First-election incumbency is lower party order");
  assert(tally.tieBreak === ElectionTieBreak.PartyOrder, "Tie break is party order");
  assert(tally.electorates[0] === 0 && tally.electorates[1] === 0, "No electorates won");
}

{
  const { state } = playToTurnOne(502);
  const [civilA, civilB] = takeFromDeck(
    state,
    (card) =>
      getCard(card.cardId).kind === CardKind.Civil &&
      (getCard(card.cardId) as { district: DistrictId }).district === DISTRICTS[0],
    2,
  );
  const district = DISTRICTS[0]!;
  state.players[0].tableau[district].push(
    { ...civilA, faceUp: true, occupiedDistrict: district },
    { ...civilB, faceUp: true, occupiedDistrict: district },
  );
  const [opp] = takeFromDeck(
    state,
    (card) =>
      getCard(card.cardId).kind === CardKind.Civil &&
      (getCard(card.cardId) as { district: DistrictId }).district === DISTRICTS[1],
  );
  state.players[1].tableau[DISTRICTS[1]!].push({
    ...opp,
    faceUp: true,
    occupiedDistrict: DISTRICTS[1],
  });
  const tally = tallyElection(state);
  assert(tally.electorates[0] === 1 && tally.electorates[1] === 1, "Split district electorates");
  assert(tally.electors[0] === 2 && tally.electors[1] === 1, "Electors are civil cards in the won district");
  assert(tally.winner === 0, "More electors wins the tie");
  assert(tally.tieBreak === ElectionTieBreak.Electors, "Tie break is electors");
}

{
  const { state } = playToTurnOne(503);
  state.election.lastWinner = 1;
  const tally = tallyElection(state);
  assert(tally.winner === 1, "Incumbent wins a full tie after the first election");
  assert(tally.tieBreak === ElectionTieBreak.Incumbent, "Tie break is incumbent");
}

{
  const { state, rng, triggerer } = triggerFirstElection(511);
  assert(state.election.active, "First GE starts an election after the triggering turn");
  assert(state.election.pendingStart === false, "Start-of-phase has run");
  assert(state.phase === "action", "First election proceeds into turns");
  assert(state.activePlayer === otherPlayer(triggerer), "Non-triggerer goes first in the first election");
  assert(state.executive === null, "Start-of-phase discards executive power");
  assert(
    state.market.length === ELECTION_MARKET_SIZE || state.deck.length === 0,
    "Start-of-phase fills the market to 8",
  );
  assert(state.electionsOut.length === 1, "Triggering GE is set aside");

  const winner = triggerer;
  let next = resolveElectionToEnd(state, rng, winner);
  assert(next.phase === "electionEnd", "Empty market ends the election");
  assert(next.election.lastWinner === winner, "Lead player wins the first election");
  assert(next.players[winner].electionWins === 1, "Winner is credited an election win");
  assert(next.players[winner].consecutiveWins === 1, "Consecutive wins start at 1");
  assert(next.activePlayer === winner, "Winner chooses the executive side");

  const chosen = chooseExecutive(next, rng);
  next = chosen.state;
  assert(
    chosen.events.some((event) => event.type === "executiveTaken"),
    "Winner takes executive power",
  );
  assert(next.executive?.owner === winner, "EP owner is the election winner");
  assert(next.executive?.side === ExecutiveSide.EmergencyState, "Winner chose Emergency State");
  assert(next.phase === "action", "Tied referendum auto-finishes into the next turn");
  assert(next.market.length === MARKET_SIZE, "End-of-phase deals a fresh market of 5");
  assert(
    next.activePlayer === otherPlayer(triggerer),
    "The player who did not trigger takes the next turn",
  );
  assert(next.election.active === false, "Election is over");
}

{
  const { state, rng, triggerer } = triggerFirstElection(591);
  const winner = triggerer;
  const loser = otherPlayer(winner);
  const district = DISTRICTS[0]!;
  const [supporter] = takeFromDeck(
    state,
    (card) =>
      getCard(card.cardId).kind !== CardKind.Election &&
      (getCard(card.cardId) as { district?: DistrictId }).district === district,
  );
  state.players[loser].policySupporters.push({ ...supporter, faceUp: false });
  let next = resolveElectionToEnd(state, rng, winner);
  next = chooseExecutive(next, rng).state;
  assert(next.executive?.owner === winner, "Winner already holds Executive Power");
  assert(next.referendum?.awaitingChoice, "End-of-election referendum still needs a policy pick");
  assert(next.referendum.chooser === loser, "The support leader chooses the policy");
  assert(
    !legalActions(next, loser).some((action) => action.type === "chooseExecutiveSide"),
    "The other player is not offered Executive Power",
  );
  assert(
    !legalActions(next, winner).some((action) => action.type === "chooseExecutiveSide"),
    "The winner cannot choose Executive Power a second time",
  );
  assert(
    legalActions(next, loser).every((action) => action.type === "choosePolicy") &&
      legalActions(next, loser).length > 0,
    "The other player only chooses the referendum policy",
  );
  try {
    apply(
      next,
      {
        type: "chooseExecutiveSide",
        player: loser,
        side: ExecutiveSide.LegalReview,
      },
      rng,
    );
    fail("Opposition choosing Executive Power should be illegal");
  } catch (error) {
    if (!(error instanceof IllegalActionError)) {
      fail(`Opposition EP choice threw ${error}`);
    }
  }
}

{
  const { state, rng, triggerer } = triggerFirstElection(521);
  state.players[triggerer].electionWins = 2;
  state.players[triggerer].consecutiveWins = 2;
  const next = resolveElectionToEnd(state, rng, triggerer);
  assert(next.victory?.kind === VictoryKind.Political, "Third consecutive win is Political Victory");
  assert(next.victory?.player === triggerer, "The streak holder wins Political");
  assert(next.phase === "gameOver", "Political Victory ends the game immediately");
  assert(next.phase === "gameOver" && next.executive === null, "No EP choice after Political Victory");
}

{
  const { state: start, rng, triggerer } = triggerFirstElection(531);
  const leftover = start.deck.filter((card) => getCard(card.cardId).kind === CardKind.Election);
  assert(leftover.length === 3, "Three GEs remain after the first is set aside");
  start.electionsOut.push(...leftover.map((card) => ({ ...card, faceUp: true })));
  start.deck = start.deck.filter((card) => getCard(card.cardId).kind !== CardKind.Election);
  let next = resolveElectionToEnd(start, rng, triggerer);
  next = chooseExecutive(next, rng).state;
  assert(next.victory?.kind === VictoryKind.Civil, "Fourth GE out ends on Civil Victory");
  assert(next.victory?.player === triggerer, "Civil goes to more election wins");
  assert(next.phase === "gameOver", "Civil Victory ends the game");
}

{
  const { state: start, rng } = playToTurnOne(541);
  start.players[0].hand = [];
  start.players[1].hand = [];
  start.players[0].electionWins = 2;
  start.players[1].electionWins = 1;
  start.election.lastWinner = 1;
  const ges = start.deck.filter((card) => getCard(card.cardId).kind === CardKind.Election);
  start.electionsOut = ges.map((card) => ({ ...card, faceUp: true }));
  start.deck = start.deck.filter((card) => getCard(card.cardId).kind !== CardKind.Election);
  start.electionTriggerer = 0;
  start.election.active = true;
  start.phase = "action";
  start.market = start.market.slice(0, 1);
  let next = playTurn(start, rng);
  assert(next.phase === "electionEnd", "Need a winner before Civil");
  assert(next.election.lastWinner === 1, "Incumbent / tally winner is player 2");
  assert(next.players[0].electionWins === 2 && next.players[1].electionWins === 2, "Final win ties the totals");
  next = chooseExecutive(next, rng).state;
  assert(next.victory?.kind === VictoryKind.Civil, "Tied Civil uses the final election winner");
  assert(next.victory?.player === 1, "Final-election winner breaks the Civil tie");
}

{
  const { state, rng, triggerer } = triggerFirstElection(551);
  let next = resolveElectionToEnd(state, rng, triggerer);
  const chained = takeGe(next);
  next.deck = [chained, ...next.deck];
  const after = chooseExecutive(next, rng);
  next = after.state;
  assert(
    after.events.some((event) => event.type === "electionSetAside" && event.cardId === chained.cardId),
    "Refresh can reveal another GE",
  );
  assert(next.election.active, "A GE on refresh starts a chained election");
  assert(next.phase === "electionStart", "Later elections let the opposition choose first");
  assert(
    next.activePlayer === otherPlayer(triggerer),
    "Opposition is the player who did not win the last election",
  );
  next = apply(next, {
    type: "chooseElectionFirst",
    player: next.activePlayer,
    firstPlayer: triggerer,
  }, rng).state;
  assert(next.phase === "action", "Opposition choice starts election turns");
  assert(next.activePlayer === triggerer, "Opposition may seat the last winner first");
  assert(
    next.market.length === ELECTION_MARKET_SIZE || next.deck.length === 0,
    "Chained start-of-phase fills to 8 again",
  );
}

{
  const { state, rng, triggerer } = triggerFirstElection(561);
  const extra = takeGe(state);
  state.deck = [extra, ...state.deck];
  const actor = state.activePlayer;
  const underLimit = state.players[actor].hand.length < state.players[actor].handLimit;
  assert(underLimit, "Election first player should still draw");
  const next = playTurn(state, rng);
  assert(
    next.electionsOut.some((card) => card.instanceId === extra.instanceId),
    "A second GE during an election is still set aside",
  );
  assert(next.election.active, "A second GE does not start a new election");
  assert(next.election.pendingStart === false, "Existing election is not re-queued");
  assert(next.electionTriggerer === triggerer, "Triggerer stays the original player");
  assert(
    next.market.length < ELECTION_MARKET_SIZE,
    "Election income does not replenish the market",
  );
}

{
  const { state: start, rng } = playToTurnOne(571);
  const actor = start.activePlayer;
  start.executive = { owner: actor, side: ExecutiveSide.EmergencyState };
  start.lastTurn = { discarded: true, addedSupport: true, player: otherPlayer(actor) };
  const civil = start.players[actor].hand.find((card) => getCard(card.cardId).kind === CardKind.Civil);
  assert(civil, "Need a civil so politics is reachable");
  let state = apply(start, {
    type: "playCivil",
    player: actor,
    instanceId: civil.instanceId,
  }, rng).state;
  assert(
    legalActions(state, actor).some((action) => action.type === "useEmergencyState"),
    "Emergency State is listed the turn after the opponent discarded",
  );
  const marketBefore = state.market.length;
  const used = apply(state, { type: "useEmergencyState", player: actor }, rng);
  state = used.state;
  assert(
    used.events.some((event) => event.type === "emergencyStateUsed"),
    "emergencyStateUsed event",
  );
  if (state.phase === "politics") {
    state = apply(state, { type: "endPolitics", player: actor }, rng).state;
  }
  if (state.phase === "income") {
    state = apply(state, {
      type: "takeMarket",
      player: actor,
      instanceId: state.market[0]!.instanceId,
    }, rng).state;
  }
  assert(state.election.active, "Emergency State starts an election after the turn");
  assert(state.electionTriggerer === actor, "The EP user is the triggerer");
  assert(state.activePlayer === otherPlayer(actor), "First election: non-triggerer goes first");
  assert(
    state.market.length === ELECTION_MARKET_SIZE || state.deck.length === 0,
    "Emergency State still fills the market to 8 at start-of-phase",
  );
  assert(state.market.length >= marketBefore, "Income during Emergency State does not shrink below the refill");
}

{
  const { state: start, rng } = playToTurnOne(581);
  const actor = start.activePlayer;
  const seat = start.players[actor];
  const filler = start.deck.filter((card) => getCard(card.cardId).kind !== CardKind.Election);
  while (seat.hand.length < seat.handLimit && filler.length > 0) {
    const card = filler.shift()!;
    start.deck = start.deck.filter((entry) => entry.instanceId !== card.instanceId);
    seat.hand.push({ ...card, faceUp: true });
  }
  const civil = start.players[actor].hand.find((card) => getCard(card.cardId).kind === CardKind.Civil);
  assert(civil, "Need a civil from a full hand");
  const ge = takeGe(start);
  start.deck = [ge, ...start.deck];
  let state = apply(start, {
    type: "playCivil",
    player: actor,
    instanceId: civil.instanceId,
  }, rng).state;
  state = apply(state, { type: "endPolitics", player: actor }, rng).state;
  assert(state.phase === "income", "Full-hand-minus-one still takes a market card");
  state = apply(state, {
    type: "takeMarket",
    player: actor,
    instanceId: state.market[0]!.instanceId,
  }, rng).state;
  assert(
    state.electionsOut.some((card) => card.instanceId === ge.instanceId),
    "GE revealed during market fill is set aside",
  );
  assert(state.election.active, "GE during replenish starts an election after the turn");
  assert(
    state.market.length === ELECTION_MARKET_SIZE || state.deck.length === 0,
    "After a fill-to-5 replenish, start-of-phase still tops up to 8",
  );
}

{
  const { state, rng, triggerer } = triggerFirstElection(601);
  const winner = triggerer;
  const opponent = otherPlayer(winner);
  let next = resolveElectionToEnd(state, rng, winner);
  next.deck = next.deck.filter((card) => getCard(card.cardId).kind !== CardKind.Election);
  next = chooseExecutive(next, rng).state;
  assert(next.executive?.owner === winner, "Winner still holds Emergency State");
  assert(next.activePlayer === opponent, "Non-triggerer takes the turn after the election");
  const district = DISTRICTS[0]!;
  const spent = takeFromDeck(
    next,
    (card) =>
      getCard(card.cardId).kind !== CardKind.Election &&
      (getCard(card.cardId) as { district?: DistrictId }).district === district,
    RECRUIT_COST,
  );
  next.players[opponent].hand = spent;
  next = apply(next, {
    type: "recruit",
    player: opponent,
    instanceIds: spent.map((card) => card.instanceId),
  }, rng).state;
  next = finishTurnAfterMain(next, rng, opponent);
  assert(next.activePlayer === winner, "Turn passes to the EP holder");
  assert(next.lastTurn.player === opponent, "Last turn was the opponent");
  assert(next.lastTurn.discarded, "Recruit counts as an opponent discard");
  const civil = firstCivil(next, winner);
  if (civil) {
    next = apply(next, {
      type: "playCivil",
      player: winner,
      instanceId: civil.instanceId,
    }, rng).state;
  } else {
    next = apply(next, { type: "endAction", player: winner }, rng).state;
  }
  assert(next.phase === "politics", "EP is used in Politics");
  assert(canUseEmergencyState(next, winner), "Earned Emergency State is legal after an opponent discard");
  const used = apply(next, { type: "useEmergencyState", player: winner }, rng);
  assert(
    used.events.some((event) => event.type === "emergencyStateUsed"),
    "Winner can fire Emergency State after earning it",
  );
}

{
  const { state: start, rng } = playToTurnOne(611);
  const actor = start.activePlayer;
  start.executive = { owner: actor, side: ExecutiveSide.LegalReview };
  start.lastTurn = { discarded: true, addedSupport: true, player: otherPlayer(actor) };
  start.policy[DISTRICTS[0]!] = PolicyId.DragonaraA;
  const civil = firstCivil(start, actor);
  assert(civil, "Need a civil so politics is reachable");
  let state = apply(start, {
    type: "playCivil",
    player: actor,
    instanceId: civil.instanceId,
  }, rng).state;
  assert(canUseLegalReview(state, actor), "Legal Review is listed after an opponent discard");
  assert(
    legalActions(state, actor).some(
      (action) => action.type === "useLegalReview" && action.district === DISTRICTS[0],
    ),
    "Legal Review targets the district with a policy",
  );
  const used = apply(state, {
    type: "useLegalReview",
    player: actor,
    district: DISTRICTS[0]!,
  }, rng);
  state = used.state;
  assert(state.policy[DISTRICTS[0]!] === null, "Legal Review sets the district to Neutral");
  assert(
    used.events.some((event) => event.type === "legalReviewUsed"),
    "legalReviewUsed event",
  );
  try {
    apply(state, {
      type: "useLegalReview",
      player: actor,
      district: DISTRICTS[0]!,
    }, rng);
    fail("Legal Review should not fire twice in one turn");
  } catch (error) {
    if (!(error instanceof IllegalActionError)) fail(`Second Legal Review threw ${error}`);
  }
}

{
  const { state: start, rng } = playToTurnOne(621);
  const actor = start.activePlayer;
  start.executive = { owner: actor, side: ExecutiveSide.EmergencyState };
  start.lastTurn = { discarded: true, addedSupport: true, player: actor };
  const civil = firstCivil(start, actor);
  assert(civil, "Need a civil so politics is reachable");
  const state = apply(start, {
    type: "playCivil",
    player: actor,
    instanceId: civil.instanceId,
  }, rng).state;
  assert(
    !canUseEmergencyState(state, actor),
    "Your own discard does not enable Emergency State",
  );
}

{
  const { state: start, rng } = playToTurnOne(631);
  const actor = start.activePlayer;
  const opponent = otherPlayer(actor);
  start.executive = { owner: opponent, side: ExecutiveSide.EmergencyState };
  const playable = start.players[actor].hand.find((card) => {
    const kind = getCard(card.cardId).kind;
    return kind === CardKind.Civil || kind === CardKind.Alliance;
  });
  assert(playable, "Need a card to play into politics");
  let state = apply(start, {
    type: playable && getCard(playable.cardId).kind === CardKind.Alliance ? "playAlliance" : "playCivil",
    player: actor,
    instanceId: playable.instanceId,
  }, rng).state;
  const tuck = state.players[actor].hand[0];
  assert(tuck, "Need a card left to campaign");
  state = apply(state, { type: "campaign", player: actor, instanceId: tuck.instanceId }, rng).state;
  if (state.phase === "politics") {
    state = apply(state, { type: "endPolitics", player: actor }, rng).state;
  }
  if (state.phase === "income") {
    state = apply(state, {
      type: "takeMarket",
      player: actor,
      instanceId: state.market[0]!.instanceId,
    }, rng).state;
  }
  assert(state.activePlayer === opponent, "Turn passes to the EP holder");
  assert(state.lastTurn.player === actor && state.lastTurn.discarded, "Campaign marked the opponent's discard");
  const civil = firstCivil(state, opponent);
  if (civil) {
    state = apply(state, {
      type: "playCivil",
      player: opponent,
      instanceId: civil.instanceId,
    }, rng).state;
  } else {
    state = apply(state, { type: "endAction", player: opponent }, rng).state;
  }
  assert(canUseEmergencyState(state, opponent), "A campaign tuck enables Emergency State next turn");
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(
  "Election ok: first election, consecutive Political, final Civil, chained GE, Emergency State.",
);
