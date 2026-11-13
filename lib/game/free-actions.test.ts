import { findDeckCards } from "../cards/catalog.ts";
import { District, MonumentId, PolicyId, type DistrictId } from "../cards/schema.ts";
import { resolveElection } from "./election.ts";
import { apply, legalActions } from "./engine.ts";
import { freeActions } from "./free-actions.ts";
import { playerDistrictInfluence } from "./influence.ts";
import type { Action, CardInstance, GameEvent, GameState, PlayerId } from "./types.ts";
import { assert, expectIllegal, playToTurnOne, report, stripElections } from "./test-helpers.ts";
import type { Rng } from "./rng.ts";

function take(state: GameState, name: string, district: DistrictId): CardInstance {
  const ids = new Set(findDeckCards({ name, district }).map((card) => card.id));
  const zones = [state.deck, state.market, state.senate, ...state.players.map((seat) => seat.hand)];
  for (const zone of zones) {
    const index = zone.findIndex((card) => ids.has(card.cardId));
    if (index >= 0) return { ...zone.splice(index, 1)[0]!, faceUp: true };
  }
  throw new Error(`${name} (${district}) not found`);
}

function place(state: GameState, player: PlayerId, name: string, district: DistrictId, lane: DistrictId = district): CardInstance {
  const card = { ...take(state, name, district), occupiedDistrict: lane };
  state.players[player].tableau[lane].push(card);
  return card;
}

function monument(id: string): CardInstance {
  return { instanceId: id, cardId: id, faceUp: true };
}

function fresh(seed: number) {
  const { state, rng } = playToTurnOne(seed);
  for (const seat of state.players) {
    state.deck.push(...seat.hand);
    seat.hand = [];
  }
  stripElections(state);
  const me = state.activePlayer as PlayerId;
  return { state, rng, me, them: (1 - me) as PlayerId };
}

function run(state: GameState, action: Action, rng: Rng): { state: GameState; events: GameEvent[] } {
  return apply(state, action, rng);
}

function freeOf(state: GameState, player: PlayerId, ability: string) {
  return freeActions(state, player).filter((action) => action.ability === ability);
}

// --- Currency Ballots ----------------------------------------------------------------
{
  const { state, rng, me } = fresh(501);
  state.policy[District.Dragonara] = PolicyId.DragonaraA;
  const civil = take(state, "Tinkers", District.Dragonara);
  const keep = take(state, "Veterans", District.Horsard);
  state.players[me].hand = [civil, keep];
  let next = run(state, { type: "playCivil", player: me, instanceId: civil.instanceId }, rng).state;
  assert(next.pending[0]?.kind === "discardOne", "Currency Ballots: draw, then a discard is owed");
  assert(next.players[me].hand.length === 2, "…after drawing one card");
  const legal = legalActions(next, me);
  assert(legal.every((action) => action.type === "chooseDiscard"), "Only the discard choice is legal");
  expectIllegal(() => run(next, { type: "endAction", player: me }, rng), "Acting before resolving the choice");
  next = run(next, { type: "chooseDiscard", player: me, instanceId: keep.instanceId }, rng).state;
  assert(next.pending.length === 0, "Choice resolved");
  assert(next.players[me].support[District.Horsard].some((card) => card.instanceId === keep.instanceId), "Discarded to the pile");
  assert(next.turn.mainActionDone, "The turn carries on after the choice");
}

// --- Urban Aristocrats ---------------------------------------------------------------
{
  const { state, rng, me, them } = fresh(502);
  place(state, me, "Urban Aristocrats", District.Dragonara);
  const mineOld = place(state, me, "Fire Breathers", District.Dragonara); // 3
  const theirs = place(state, them, "Technocrats", District.Dragonara); // 9
  const played = take(state, "Tinkers", District.Dragonara);
  state.players[me].hand = [played];
  let next = run(state, { type: "playCivil", player: me, instanceId: played.instanceId }, rng).state;
  assert(next.pending[0]?.kind === "swapCivils", "Urban Aristocrats offers a swap");
  next = run(next, { type: "chooseSwap", player: me, swap: { mine: mineOld.instanceId, theirs: theirs.instanceId } }, rng).state;
  assert(next.players[me].tableau[District.Dragonara].some((card) => card.instanceId === theirs.instanceId), "Their 9 is now yours");
  assert(next.players[them].tableau[District.Dragonara].some((card) => card.instanceId === mineOld.instanceId), "Your 3 is now theirs");
}

// --- Kybernetik Inc. -----------------------------------------------------------------
{
  const { state, rng, me } = fresh(503);
  const source = place(state, me, "Kybernetik Inc.", District.Dragonara);
  state.players[me].hand = [take(state, "Veterans", District.Horsard)];
  const marketBefore = state.market.length;
  let next = run(state, { type: "freeAction", player: me, source: source.instanceId, ability: "kybernetik" }, rng).state;
  assert(next.players[me].hand.length === 5, "Kybernetik draws to the hand limit");
  assert(next.phase === "politics", "…ends the action step (replacing the main action)");
  next = run(next, { type: "endPolitics", player: me }, rng).state;
  assert(next.activePlayer !== me, "…and skips income");
  assert(next.market.length === marketBefore, "No Market refill or take without income");
}

// --- Foreign Inc. --------------------------------------------------------------------
{
  const { state, rng, me } = fresh(504);
  const source = place(state, me, "Foreign Inc.", District.Horsard);
  const horsard = take(state, "Veterans", District.Horsard);
  const other = take(state, "Tinkers", District.Dragonara);
  state.players[me].hand = [horsard, other];
  expectIllegal(
    () => run(state, { type: "freeAction", player: me, source: source.instanceId, ability: "foreignInc", instanceId: other.instanceId }, rng),
    "Foreign Inc. of Horsard seats only a Horsard card",
  );
  const next = run(state, { type: "freeAction", player: me, source: source.instanceId, ability: "foreignInc", instanceId: horsard.instanceId }, rng).state;
  assert(next.senate[0]?.instanceId === horsard.instanceId, "Seated leftmost");
  assert(next.players[me].hand.length === 2, "…then drew a card");
  assert(next.phase === "action" && !next.turn.mainActionDone, "The main action is still to come");
  assert(freeOf(next, me, "foreignInc").length === 0, "Once per turn");
}

// --- Century Inc. --------------------------------------------------------------------
{
  const { state, rng, me, them } = fresh(505);
  const source = place(state, me, "Century Inc.", District.Horsard);
  const target = place(state, them, "Financial Bankers", District.Horsard);
  const incoming = take(state, "Order of Knights", District.Shavvinne);
  state.players[me].hand = [incoming];
  const next = run(state, {
    type: "freeAction",
    player: me,
    source: source.instanceId,
    ability: "centuryInc",
    instanceId: incoming.instanceId,
    target: { owner: them, instanceId: target.instanceId },
  }, rng).state;
  assert(next.players[them].support[District.Horsard].some((card) => card.instanceId === target.instanceId), "Replaced alliance goes to its owner's pile");
  const lane = next.players[them].tableau[District.Horsard];
  assert(lane.some((card) => card.instanceId === incoming.instanceId), "The new alliance is played for them, in that lane");
}

// --- Architecture Inc. and Rebel Inc. --------------------------------------------------
{
  const { state, rng, me } = fresh(506);
  const architect = place(state, me, "Architecture Inc.", District.Shavvinne);
  const rebel = place(state, me, "Rebel Inc.", District.Shavvinne);
  // Build Dragon Gate with four Dragonara cards.
  state.availableMonuments = [monument(MonumentId.DragonGate)];
  const four = ["Tinkers", "Engineers", "Gardeners", "Fire Breathers"].map((name) => take(state, name, District.Dragonara));
  state.players[me].hand = [...four];
  let next = run(state, {
    type: "freeAction",
    player: me,
    source: architect.instanceId,
    ability: "architectureInc",
    instanceIds: four.map((card) => card.instanceId),
    monumentInstanceId: MonumentId.DragonGate,
  }, rng).state;
  assert(next.players[me].monuments.some((card) => card.cardId === MonumentId.DragonGate), "Architecture Inc. builds with only 4 cards");
  assert(!next.turn.mainActionDone, "…as a free action");

  const three = ["Time Travelers", "Runes Tavern", "Dune Clans"].map((name) => take(next, name, District.Dragonara));
  next.players[me].hand = [...three];
  next = run(next, { type: "freeAction", player: me, source: rebel.instanceId, ability: "rebelInc", instanceIds: three.map((c) => c.instanceId) }, rng).state;
  assert(next.players[me].partisans === 1, "Rebel Inc. recruits as a free action");
}

// --- Capitol Inc. --------------------------------------------------------------------
{
  const { state, rng, me } = fresh(507);
  const capitol = place(state, me, "Capitol Inc.", District.Smarbbit);
  state.senate = ["Anarchists", "Radio Stations", "NGOs", "Universities", "The Capitalists"].map((name) => take(state, name, District.Smarbbit));
  const reveal = [take(state, "Abolitionists", District.Smarbbit), take(state, "Communists", District.Smarbbit)];
  state.players[me].hand = [...reveal];
  const next = run(state, {
    type: "freeAction",
    player: me,
    source: capitol.instanceId,
    ability: "capitolInc",
    revealIds: reveal.map((c) => c.instanceId),
    discardId: reveal[0]!.instanceId,
    district: District.Smarbbit,
    policyId: PolicyId.SmarbbitA,
  }, rng).state;
  assert(next.policy[District.Smarbbit] === PolicyId.SmarbbitA, "Capitol Inc. proposes a policy as a free action");
  assert(next.phase === "action", "…in the action step, before Politics");
}

// --- Intel Network ---------------------------------------------------------------------
{
  const { state, rng, me } = fresh(508);
  state.players[me].monuments.push(monument(MonumentId.IntelNetwork));
  let next = run(state, { type: "freeAction", player: me, source: MonumentId.IntelNetwork, ability: "intelNetwork" }, rng).state;
  const choice = next.pending[0];
  assert(choice?.kind === "intelNetwork" && choice.instanceIds.length === 5, "Intel Network shows the top 5");
  const pick = choice!.kind === "intelNetwork" ? choice!.instanceIds[3]! : "";
  next = run(next, { type: "chooseIntel", player: me, instanceId: pick }, rng).state;
  assert(next.deck[0]?.instanceId === pick, "The chosen card moves to the top");
}

// --- People's Press ----------------------------------------------------------------
{
  const { state, rng, me } = fresh(509);
  place(state, me, "People's Press", District.Smarbbit);
  const saved = take(state, "Anarchists", District.Smarbbit);
  state.players[me].support[District.Smarbbit] = [saved];
  state.players[me].hand = [take(state, "Veterans", District.Horsard)];
  let next = run(state, { type: "playCivil", player: me, instanceId: state.players[me].hand[0]!.instanceId }, rng).state;
  if (next.phase === "action") next = run(next, { type: "endAction", player: me }, rng).state;
  next = run(next, { type: "endPolitics", player: me }, rng).state;
  next = run(next, { type: "takeMarket", player: me, instanceId: next.market[0]!.instanceId }, rng).state;
  assert(next.pending[0]?.kind === "peoplesPress", "People's Press offers the support pile at the income draw");
  next = run(next, { type: "choosePress", player: me, instanceId: saved.instanceId }, rng).state;
  assert(next.players[me].hand.some((card) => card.instanceId === saved.instanceId), "Took the card from the Smarbbit pile");
  assert(next.activePlayer !== me, "Then the turn ends");
}

// --- Space Agency ------------------------------------------------------------------
{
  const { state, rng, me } = fresh(510);
  state.players[me].monuments.push(monument(MonumentId.SpaceAgency));
  state.players[me].support[District.Horsard] = [take(state, "Arms Dealers", District.Horsard)];
  const three = ["Veterans", "Masons Guild", "Urban Planners"].map((name) => take(state, name, District.Horsard));
  state.players[me].hand = [...three];
  let next = run(state, { type: "recruit", player: me, instanceIds: three.map((c) => c.instanceId) }, rng).state;
  assert(next.pending[0]?.kind === "routeDiscards", "Space Agency offers to route the discards");
  expectIllegal(
    () => run(next, { type: "routeDiscards", player: me, moves: [
      { instanceId: three[0]!.instanceId, district: District.Dragonara },
      { instanceId: three[1]!.instanceId, district: District.Dragonara },
    ] }, rng),
    "At most one card into each pile",
  );
  next = run(next, { type: "routeDiscards", player: me, moves: [
    { instanceId: three[0]!.instanceId, district: District.Dragonara },
    { instanceId: three[1]!.instanceId, district: District.Shavvinne },
  ] }, rng).state;
  assert(next.players[me].support[District.Dragonara].length === 1, "One moved to Dragonara");
  assert(next.players[me].support[District.Shavvinne].length === 1, "One moved to Shavvinne");
  assert(next.players[me].support[District.Horsard].length === 2, "The rest stay in Horsard");
}

// --- Planet Next, Consultative Office, State Enterprise -------------------------------
{
  const { state, rng, me } = fresh(511);
  state.players[me].monuments.push(monument(MonumentId.PlanetNext));
  state.policy[District.Smarbbit] = PolicyId.SmarbbitB;
  const horsard = take(state, "Veterans", District.Horsard);
  const smarbbit = take(state, "Anarchists", District.Smarbbit);
  state.players[me].hand = [horsard, smarbbit];
  let next = run(state, { type: "setAside", player: me, zone: "planetNextBank", instanceIds: [horsard.instanceId] }, rng).state;
  next = run(next, { type: "setAside", player: me, zone: "consultativeOffice", instanceIds: [smarbbit.instanceId] }, rng).state;
  assert(next.players[me].hand.length === 0, "Both set aside");
  assert(playerDistrictInfluence(next, me, District.Horsard).bank === 1, "Planet Next: +1 Horsard influence per banked card");
  expectIllegal(
    () => run(next, { type: "setAside", player: me, zone: "planetNextBank", instanceIds: [smarbbit.instanceId] }, rng),
    "Only Horsard cards go to the bank",
  );
  next = run(next, { type: "playCivil", player: me, instanceId: horsard.instanceId }, rng).state;
  assert(next.players[me].tableau[District.Horsard].some((card) => card.instanceId === horsard.instanceId), "Banked cards play as if in hand");
  assert(playerDistrictInfluence(next, me, District.Horsard).bank === 0, "…and stop counting once used");
}

{
  const { state, rng, me } = fresh(512);
  place(state, me, "State Enterprise", District.Dragonara);
  const civil = take(state, "Technocrats", District.Dragonara);
  state.market[0] = civil;
  state.players[me].hand = [];
  assert(legalActions(state, me).some((a) => a.type === "playCivil" && a.instanceId === civil.instanceId), "State Enterprise: play a Dragonara civil from the Market");
  const next = run(state, { type: "playCivil", player: me, instanceId: civil.instanceId }, rng).state;
  assert(next.market.length === 4, "The Market stays short until the next refill");
}

// --- Diet of Saints after an election ------------------------------------------------
{
  const { state, me, them } = fresh(513);
  place(state, me, "Diet of Saints", District.Shavvinne);
  const mine = place(state, me, "Farmers", District.Shavvinne);
  const theirs = place(state, them, "Teachers", District.Shavvinne);
  state.election.active = true;
  state.election.generalElections = 1;
  state.market = [];
  const events: GameEvent[] = [];
  resolveElection(state, them, events);
  assert(state.players[me].tableau[District.Shavvinne].every((card) => card.instanceId !== mine.instanceId), "Your Shavvinne civils are discarded");
  assert(state.players[them].support[District.Shavvinne].some((card) => card.instanceId === theirs.instanceId), "Theirs go to their own pile");
}

report("Free actions and choices ok: Currency Ballots, Urban Aristocrats, Kybernetik, Foreign Inc., Century Inc., Architecture Inc., Rebel Inc., Capitol Inc., Intel Network, People's Press, Space Agency, Planet Next, Consultative Office, State Enterprise, Diet of Saints.");
