import { getCard } from "../cards/catalog.ts";
import { CardKind, DecreeId, DISTRICTS, MonumentId, type DistrictId } from "../cards/schema.ts";
import {
  apply,
  declarableVictories,
  ElectionTieBreak,
  legalActions,
  meetsDecree,
  otherPlayer,
  passesDeJuresIn,
  tallyElection,
  VictoryKind,
  type CardInstance,
  type GameState,
  type PlayerId,
  type Rng,
} from "./index.ts";
import {
  assert,
  expectIllegal,
  isKind,
  playPlainTurn,
  playToTurnOne,
  report,
  stripElections,
  takeFromDeck,
} from "./test-helpers.ts";

function civilWorth(state: GameState, value: number, district?: DistrictId): CardInstance {
  return takeFromDeck(state, (card) => {
    const def = getCard(card.cardId);
    return (
      def.kind === CardKind.Civil &&
      def.influence === value &&
      (district === undefined || def.district === district)
    );
  })[0]!;
}

/** Give `player` a clear influence lead in every district. */
function sweepDistricts(state: GameState, player: PlayerId): void {
  for (const district of DISTRICTS) {
    const card = takeFromDeck(
      state,
      (entry) => isKind(entry, CardKind.Civil) && getCard(entry.cardId).kind === CardKind.Civil &&
        (getCard(entry.cardId) as { district: DistrictId }).district === district,
    )[0]!;
    state.players[player].tableau[district].push({ ...card, faceUp: true });
  }
}

/** Start an election by putting a GE on top of the deck and playing a plain turn. */
function openElection(state: GameState, rng: Rng): GameState {
  const ges = stripElections(state);
  state.deck = [ges[0]!, ...state.deck, ...ges.slice(1)];
  return playPlainTurn(state, rng);
}

/** Play plain turns until the election resolves (Market emptied). */
function runElection(state: GameState, rng: Rng): GameState {
  let next = state;
  for (let guard = 0; guard < 40 && next.election.active && next.phase !== "gameOver"; guard++) {
    // Keep both hands short so every income step takes from the Market.
    for (const seat of next.players) seat.hand = seat.hand.slice(0, 1);
    next = playPlainTurn(next, rng);
  }
  return next;
}

// --- A revealed GE opens the phase right away; a second one only adds to the count -----
{
  const { state: start, rng } = playToTurnOne(201);
  const actor = start.activePlayer;
  const ges = stripElections(start);
  // Market refill reveals GE #1; the deck draw right after reveals GE #2.
  start.deck = [ges[0]!, ...start.deck.slice(0, 8), ges[1]!, ...start.deck.slice(8), ...ges.slice(2)];
  const state = playPlainTurn(start, rng);
  assert(state.election.active, "Election phase is active");
  assert(state.market.length === 8, `Market fills to 8, got ${state.market.length}`);
  assert(state.activePlayer === otherPlayer(actor), "Turn order unchanged: the opponent opens the election");
  assert(state.phase === "action", "Play just continues");
  assert(state.electionsOut.length >= 1, "GE set aside");
}

// --- Resolution: Market empty after a turn, winner activates decrees, order resumes --------
{
  const { state: start, rng } = playToTurnOne(211);
  const winner = start.activePlayer;
  sweepDistricts(start, winner);
  let state = openElection(start, rng);
  assert(state.election.generalElections === 1, "One GE this phase");
  state = runElection(state, rng);

  assert(!state.election.active, "Election resolved once the Market ran dry");
  assert(state.players[winner].electionWins === 1, "Winner recorded");
  assert(state.election.lastWinner === winner, "Winner becomes the incumbent");
  assert(state.phase === "decreeChoice", `Winner owes a decree, phase ${state.phase}`);
  assert(state.activePlayer === winner, "Winner chooses");
  const loser = otherPlayer(winner);
  assert(legalActions(state, loser).length === 0, "Only the winner acts now");
  const options = legalActions(state, winner);
  assert(options.length === 4 && options.every((a) => a.type === "activateDecree"), "Any of the 4 inactive decrees");

  const nextPlayer = state.pendingDecrees!.nextPlayer;
  expectIllegal(
    () => apply(state, { type: "activateDecree", player: loser, decreeId: DecreeId.Imperium }, rng),
    "Loser cannot activate",
  );
  state = apply(state, { type: "activateDecree", player: winner, decreeId: DecreeId.Imperium }, rng).state;
  assert(state.decrees.find((d) => d.id === DecreeId.Imperium)!.active, "Imperium is active");
  assert(state.phase === "action", "Back to normal play");
  assert(state.activePlayer === nextPlayer, "Normal turn order resumes");
  assert(state.market.length === 5 || state.election.active, "Market refilled to 5");
}

// --- Two GEs in one phase → two decree activations ------------------------------------
{
  const { state: start, rng } = playToTurnOne(221);
  const winner = start.activePlayer;
  sweepDistricts(start, winner);
  let state = openElection(start, rng);
  const ges = state.deck.filter((card) => isKind(card, CardKind.Election));
  state.deck = [ges[0]!, ...state.deck.filter((card) => !isKind(card, CardKind.Election)), ...ges.slice(1)];
  state = runElection(state, rng);
  assert(state.pendingDecrees?.remaining === 2, `Two decrees owed, got ${state.pendingDecrees?.remaining}`);
  state = apply(state, { type: "activateDecree", player: winner, decreeId: DecreeId.Profectus }, rng).state;
  assert(state.phase === "decreeChoice", "Still one to go");
  state = apply(state, { type: "activateDecree", player: winner, decreeId: DecreeId.Academia }, rng).state;
  assert(state.phase === "action", "Done choosing");
}

// --- Tie-breaks -------------------------------------------------------------------
{
  const { state } = playToTurnOne(231);
  const first = state.firstPlayer!;
  const tie = tallyElection(state);
  assert(tie.tieBreak === ElectionTieBreak.FirstPlayer && tie.winner === first, "Empty board: first player wins the first election");
  state.election.lastWinner = otherPlayer(first);
  assert(tallyElection(state).winner === otherPlayer(first), "Later: the incumbent wins ties");

  const [d1, d2] = state.districtOrder;
  state.players[0].tableau[d1!].push(civilWorth(state, 9, d1));
  state.players[1].tableau[d2!].push(civilWorth(state, 8, d2), civilWorth(state, 3, d2));
  const byCards = tallyElection(state);
  assert(byCards.tieBreak === ElectionTieBreak.Electors, "1–1 electorates: compare cards in won electorates");
  assert(byCards.winner === 1, "Two cards beat one");
}

// --- Final election ends the game with Civil Victory ---------------------------------
{
  const { state: start, rng } = playToTurnOne(241);
  const winner = start.activePlayer;
  sweepDistricts(start, winner);
  const ges = stripElections(start);
  start.electionsOut = ges.slice(1).map((card) => ({ ...card, faceUp: true }));
  start.deck = [ges[0]!, ...start.deck];
  let state = playPlainTurn(start, rng);
  state = runElection(state, rng);
  assert(state.phase === "gameOver", "Final election ends the game");
  assert(state.victory?.kind === VictoryKind.Civil && state.victory.player === winner, "Final election winner takes Civil");
}

// --- Roman Basilica: Civil after 3 election wins --------------------------------------
{
  const { state } = playToTurnOne(251);
  const owner = state.activePlayer;
  state.players[owner].monuments = [
    { instanceId: MonumentId.RomanBasilica, cardId: MonumentId.RomanBasilica, faceUp: true },
  ];
  state.phase = "politics";
  state.players[owner].electionWins = 2;
  assert(
    !declarableVictories(state, owner).some((v) => v.kind === VictoryKind.Civil),
    "Two wins is not enough",
  );
  state.players[owner].electionWins = 3;
  assert(
    declarableVictories(state, owner).some((v) => v.kind === VictoryKind.Civil),
    "Three wins: the Basilica owner may declare Civil",
  );
  state.players[otherPlayer(owner)].electionWins = 3;
  assert(
    !declarableVictories(state, otherPlayer(owner)).some((v) => v.kind === VictoryKind.Civil),
    "Without the Basilica, wins don't declare Civil",
  );
}

// --- De Jures per district -----------------------------------------------------------
{
  const { state } = playToTurnOne(261);
  const [d1, d2, d3, d4] = state.districtOrder as [DistrictId, DistrictId, DistrictId, DistrictId];
  assert(passesDeJuresIn(state, 0, d1) && passesDeJuresIn(state, 1, d1), "Nobody has civil cards: both pass");
  state.players[0].tableau[d1].push(civilWorth(state, 4, d1));
  assert(passesDeJuresIn(state, 0, d1), "Only you have civil cards: you pass");
  assert(!passesDeJuresIn(state, 1, d1), "No civil cards while the opponent has some: fail");
  state.players[1].tableau[d1].push(civilWorth(state, 4, d1));
  assert(passesDeJuresIn(state, 0, d1) && passesDeJuresIn(state, 1, d1), "Tied lowest: both pass");
  state.players[1].tableau[d1].push(civilWorth(state, 3, d1));
  assert(!passesDeJuresIn(state, 0, d1) && passesDeJuresIn(state, 1, d1), "Lower card wins the district");

  assert(meetsDecree(state, 1, DecreeId.DeJures), "Player 2 passes all four (three empty districts)");
  assert(!meetsDecree(state, 0, DecreeId.DeJures), "Player 1 fails d1");
  state.players[0].tableau[d2].push(civilWorth(state, 5, d2));
  assert(!meetsDecree(state, 1, DecreeId.DeJures), "Player 2 now fails d2");
  void d3;
  void d4;
}

report("Election ok: GE opens phase (Market 8, order unchanged), resolution, decree choice, tie-breaks, final Civil, Roman Basilica, De Jures.");
