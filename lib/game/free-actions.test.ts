import { findDeckCards, getCard } from "../cards/catalog.ts";
import { CardKind, District, MonumentId, PolicyId, type DistrictId } from "../cards/schema.ts";
import { handLimit } from "./abilities.ts";
import { printedDistrict } from "./main.ts";
import { resolveElection } from "./election.ts";
import { apply, legalActions } from "./engine.ts";
import { freeActions } from "./free-actions.ts";
import { networkDistricts } from "./network.ts";
import { proposalDistricts } from "./senate.ts";
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

/** A civil card kept in hand so a free action never leaves the main action unreachable. */
function spare(state: GameState): CardInstance {
  return take(state, "Veterans", District.Horsard);
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

// Urban Aristocrats swaps any played cards (Joe, 2026-11-26), as long as nobody ends up over
// their alliance limit in Dragonara.
{
  const { state, rng, me, them } = fresh(509);
  const urban = place(state, me, "Urban Aristocrats", District.Dragonara);
  const mineCivil = place(state, me, "Fire Breathers", District.Dragonara);
  const theirAlliance = place(state, them, "Kybernetik Inc.", District.Dragonara);
  const theirCivil = place(state, them, "Technocrats", District.Dragonara);
  const played = take(state, "Tinkers", District.Dragonara);
  state.players[me].hand = [played];
  const paused = run(state, { type: "playCivil", player: me, instanceId: played.instanceId }, rng).state;
  const offered = legalActions(paused, me).filter((action) => action.type === "chooseSwap" && action.swap);
  const offers = (a: CardInstance, b: CardInstance) =>
    offered.some((action) => action.type === "chooseSwap" && action.swap?.mine === a.instanceId && action.swap.theirs === b.instanceId);
  assert(offers(urban, theirAlliance), "An alliance for an alliance (Urban Aristocrats itself included)");
  assert(offers(mineCivil, theirCivil), "A civil for a civil, as before");
  assert(!offers(mineCivil, theirAlliance), "Not a civil for their alliance: you'd hold two alliances there");
  assert(!offers(urban, theirCivil), "Not your alliance for their civil: they'd hold two");
  expectIllegal(
    () => run(paused, { type: "chooseSwap", player: me, swap: { mine: mineCivil.instanceId, theirs: theirAlliance.instanceId } }, rng),
    "Swapping into two alliances",
  );
  const next = run(paused, { type: "chooseSwap", player: me, swap: { mine: urban.instanceId, theirs: theirAlliance.instanceId } }, rng).state;
  assert(next.players[me].tableau[District.Dragonara].some((card) => card.instanceId === theirAlliance.instanceId), "Their Kybernetik Inc. is now yours");
  assert(next.players[them].tableau[District.Dragonara].some((card) => card.instanceId === urban.instanceId), "…and your Urban Aristocrats theirs");
}

// --- Kybernetik Inc. -----------------------------------------------------------------
{
  const { state, rng, me } = fresh(503);
  const source = place(state, me, "Kybernetik Inc.", District.Dragonara);
  const veterans = take(state, "Veterans", District.Horsard);
  state.players[me].hand = [veterans, take(state, "Tinkers", District.Dragonara)];
  const marketBefore = state.market.length;
  const kybernetik: Action = { type: "freeAction", player: me, source: source.instanceId, ability: "kybernetik" };
  // "Right after main action" (Joe, 2026-11-26): no longer in place of it.
  assert(!legalActions(state, me).some((action) => action.type === "freeAction" && action.ability === "kybernetik"), "Kybernetik isn't offered before the main action");
  expectIllegal(() => run(state, kybernetik, rng), "Kybernetik before the main action");
  let next = run(state, { type: "playCivil", player: me, instanceId: veterans.instanceId }, rng).state;
  assert(next.phase === "action" && next.turn.mainActionDone, "The main action leaves the action step open");
  next = run(next, kybernetik, rng).state;
  assert(next.players[me].hand.length === 5, "Kybernetik then draws to the hand limit");
  assert(next.phase === "politics", "…ends the action step, and Politics follows");
  next = run(next, { type: "endPolitics", player: me }, rng).state;
  assert(next.activePlayer !== me, "…and income is skipped");
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
  const displaced = state.senate[state.senate.length - 1]!;
  const next = run(state, { type: "freeAction", player: me, source: source.instanceId, ability: "foreignInc", instanceId: horsard.instanceId }, rng).state;
  assert(next.senate[0]?.instanceId === horsard.instanceId, "Seated leftmost");
  const supportIds = Object.values(next.players[me].support).flat().map((card) => card.instanceId);
  const routing = next.pending.some((choice) => choice.kind === "routeDiscards");
  assert(supportIds.includes(displaced.instanceId) || routing, "The displaced Senator goes to the support pile");
  assert(!next.players[me].hand.some((card) => card.instanceId === displaced.instanceId), "…not back to the hand");
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
  state.players[me].hand = [incoming, spare(state)];
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
  // Two alliances in one lane need Model Society (limit 2), or the limit check discards one.
  state.players[me].monuments.push(monument(MonumentId.ModelSociety));
  // Build Dragon Gate (Dragonara) with three Dragonara cards and two Shavvinne ones: Architecture
  // Inc. makes Shavvinne cards wild (Joe, 2026-11-26; it used to build with only 4 cards).
  state.availableMonuments = [monument(MonumentId.DragonGate)];
  const three = ["Tinkers", "Engineers", "Gardeners"].map((name) => take(state, name, District.Dragonara));
  const wild = ["TuWang Gang", "Teachers"].map((name) => take(state, name, District.Shavvinne));
  const keep = spare(state);
  state.players[me].hand = [...three, ...wild, keep];
  const build = (ids: CardInstance[]): Action => ({
    type: "freeAction",
    player: me,
    source: architect.instanceId,
    ability: "architectureInc",
    instanceIds: ids.map((card) => card.instanceId),
    monumentInstanceId: MonumentId.DragonGate,
  });
  expectIllegal(() => run(state, build([...three, wild[0]!]), rng), "Architecture Inc. no longer builds with 4 cards");
  expectIllegal(() => apply(state, { type: "construct", player: me, instanceIds: [...three, ...wild].map((card) => card.instanceId), monumentInstanceId: MonumentId.DragonGate }, rng), "Shavvinne cards aren't wild for a normal build");
  let next = run(state, build([...three, ...wild]), rng).state;
  assert(next.players[me].monuments.some((card) => card.cardId === MonumentId.DragonGate), "Architecture Inc. builds with Shavvinne cards as wild");
  assert(next.players[me].support[District.Shavvinne].length === 2, "…the wild cards go to their own district's pile");
  assert(!next.turn.mainActionDone, "…as a free action");

  const recruits = ["Time Travelers", "Runes Tavern", "Dune Clans"].map((name) => take(next, name, District.Dragonara));
  next.players[me].hand = [...recruits, keep];
  next = run(next, { type: "freeAction", player: me, source: rebel.instanceId, ability: "rebelInc", instanceIds: recruits.map((c) => c.instanceId) }, rng).state;
  assert(next.players[me].partisans === 1, "Rebel Inc. recruits as a free action (not behind: the usual 1)");
}

// Rebel Inc. when behind (Joe, 2026-11-26: "If you're behind, get +2. Else, get +1").
{
  const { state, rng, me, them } = fresh(508);
  const rebel = place(state, me, "Rebel Inc.", District.Shavvinne);
  state.players[me].partisans = 1;
  state.players[them].partisans = 2;
  state.players[me].support[District.Dragonara].push(take(state, "Engineers", District.Dragonara));
  const recruits = ["Time Travelers", "Runes Tavern", "Dune Clans"].map((name) => take(state, name, District.Dragonara));
  state.players[me].hand = [...recruits, spare(state)];
  const next = run(state, { type: "freeAction", player: me, source: rebel.instanceId, ability: "rebelInc", instanceIds: recruits.map((c) => c.instanceId) }, rng).state;
  assert(next.players[me].partisans === 3, "Behind 1–2, Rebel Inc. recruits 2 partisans");
  const plain = structuredClone(state);
  const main = run(plain, { type: "recruit", player: me, instanceIds: recruits.map((c) => c.instanceId) }, rng).state;
  assert(main.players[me].partisans === 2, "…a recruit without it still gets 1");
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
    // One 9 convinces all five Smarbbit Senators; revealing both 9s would double up (2026-11-15).
    revealIds: [reveal[0]!.instanceId],
    discardId: reveal[0]!.instanceId,
    district: District.Smarbbit,
    policyId: PolicyId.SmarbbitA,
  }, rng).state;
  assert(next.policy[District.Smarbbit] === PolicyId.SmarbbitA, "Capitol Inc. proposes a policy as a free action");
  assert(next.phase === "action", "…in the action step, before Politics");

  // Joe, 2026-11-26: "you may choose any district policy as target" — here Horsard, where no
  // Senator was convinced. A normal proposal could only change Smarbbit's.
  assert(!proposalDistricts(state, [reveal[0]!.cardId]).has(District.Horsard), "A normal proposal can't reach Horsard");
  const offered = freeActions(state, me).filter((action) => action.type === "freeAction" && action.ability === "capitolInc");
  assert(offered.some((action) => "district" in action && action.district === District.Horsard), "Capitol Inc. offers Horsard's policy too");
  const anywhere = run(state, {
    type: "freeAction",
    player: me,
    source: capitol.instanceId,
    ability: "capitolInc",
    revealIds: [reveal[0]!.instanceId],
    discardId: reveal[0]!.instanceId,
    district: District.Horsard,
    policyId: PolicyId.HorsardA,
  }, rng).state;
  assert(anywhere.policy[District.Horsard] === PolicyId.HorsardA, "…and changes it");
}

// --- Intel Network ---------------------------------------------------------------------
{
  const { state, rng, me } = fresh(508);
  state.players[me].monuments.push(monument(MonumentId.IntelNetwork));
  state.players[me].hand = [spare(state)];
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

// --- Space Academy (was Space Agency): one card per discard (card updated 2026-11-18) ----
{
  const { state, rng, me } = fresh(510);
  state.players[me].monuments.push(monument(MonumentId.SpaceAgency));
  state.players[me].support[District.Horsard] = [take(state, "Arms Dealers", District.Horsard)];
  const three = ["Veterans", "Masons Guild", "Urban Planners"].map((name) => take(state, name, District.Horsard));
  state.players[me].hand = [...three];
  let next = run(state, { type: "recruit", player: me, instanceIds: three.map((c) => c.instanceId) }, rng).state;
  assert(next.pending[0]?.kind === "routeDiscards", "Space Academy offers to move a discard");
  expectIllegal(
    () => run(next, { type: "routeDiscards", player: me, moves: [
      { instanceId: three[0]!.instanceId, district: District.Dragonara },
      { instanceId: three[1]!.instanceId, district: District.Shavvinne },
    ] }, rng),
    "At most one card each time you discard, even into different piles",
  );
  next = run(next, { type: "routeDiscards", player: me, moves: [
    { instanceId: three[0]!.instanceId, district: District.Dragonara },
  ] }, rng).state;
  assert(next.players[me].support[District.Dragonara].length === 1, "One moved to Dragonara");
  assert(next.players[me].support[District.Horsard].length === 3, "The rest stay in Horsard");
}

// --- Network: Planet Next, Consultative Office (Joe via Ian, 2026-11-18) --------------
{
  const { state, rng, me, them } = fresh(511);
  state.players[me].monuments.push(monument(MonumentId.PlanetNext));
  state.policy[District.Smarbbit] = PolicyId.SmarbbitB;
  const horsard = take(state, "Veterans", District.Horsard);
  const smarbbit = take(state, "Anarchists", District.Smarbbit);
  state.players[me].hand = [horsard, smarbbit];
  assert(
    networkDistricts(state, me).join() === "horsard,smarbbit" && networkDistricts(state, them).join() === "smarbbit",
    "Planet Next enables Horsard for its owner only; Consultative Office enables Smarbbit for both",
  );
  let next = run(state, { type: "toNetwork", player: me, instanceIds: [horsard.instanceId] }, rng).state;
  next = run(next, { type: "toNetwork", player: me, instanceIds: [smarbbit.instanceId] }, rng).state;
  assert(next.players[me].hand.length === 0 && next.players[me].network.length === 2, "Both moved into the network");
  assert(next.players[me].network.every((card) => card.faceUp), "Network cards are revealed");
  assert(playerDistrictInfluence(next, me, District.Horsard).bank === 1, "Planet Next: +1 Horsard influence per card in your Horsard network");
  expectIllegal(
    () => run(next, { type: "toNetwork", player: them, instanceIds: [horsard.instanceId] }, rng),
    "Only the active player moves cards, and only their own",
  );

  // Out and back in, freely, during your turn.
  const out = run(next, { type: "fromNetwork", player: me, instanceIds: [horsard.instanceId] }, rng).state;
  assert(out.players[me].hand.some((card) => card.instanceId === horsard.instanceId), "fromNetwork: back into hand");
  assert(playerDistrictInfluence(out, me, District.Horsard).bank === 0, "…and its +1 goes with it");

  next = run(next, { type: "playCivil", player: me, instanceId: horsard.instanceId }, rng).state;
  assert(next.players[me].tableau[District.Horsard].some((card) => card.instanceId === horsard.instanceId), "Network cards play as if in hand");

  // Joe's report (seed 4285140960): Consultative Office proposed away, cards stayed "in office".
  const closed = structuredClone(next);
  closed.policy[District.Smarbbit] = null;
  const after = run(closed, { type: closed.phase === "politics" ? "endPolitics" : "endAction", player: me }, rng);
  assert(after.state.players[me].network.length === 0, "Office gone: the Smarbbit network empties");
  assert(after.state.players[me].hand.some((card) => card.instanceId === smarbbit.instanceId), "…its cards go back to hand");
  assert(after.events.some((event) => event.type === "networkReturned"), "…with a networkReturned event");

  // Records from before the network: setAside replays as toNetwork.
  const legacy = run(state, { type: "setAside", player: me, zone: "planetNextBank", instanceIds: [horsard.instanceId] }, rng).state;
  assert(legacy.players[me].network.some((card) => card.instanceId === horsard.instanceId), "Legacy setAside replays into the network");
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

// --- Main-action ruling (Ian, 2026-11-14) --------------------------------------
{
  // A free action that would leave no main action is illegal before the main action.
  const { state, rng, me } = fresh(520);
  const rebel = place(state, me, "Rebel Inc.", District.Shavvinne);
  state.players[me].support[District.Dragonara] = [take(state, "Gardeners", District.Dragonara)];
  const three = ["Tinkers", "Engineers", "Fire Breathers"].map((name) => take(state, name, District.Dragonara));
  state.players[me].hand = [...three];
  const rebelUse = { type: "freeAction" as const, player: me, source: rebel.instanceId, ability: "rebelInc" as const, instanceIds: three.map((c) => c.instanceId) };
  assert(!legalActions(state, me).some((a) => a.type === "freeAction"), "Main action: a dead-end free action is not offered");
  expectIllegal(() => run(state, rebelUse, rng), "Main action: Rebel Inc. spending the whole hand first");
  assert(!legalActions(state, me).some((a) => a.type === "endAction"), "Main action: no stuck draw while one is available");

  // Same free action with a spare card: legal, and it may also follow the main action.
  const keep = spare(state);
  state.players[me].hand = [...three, keep];
  assert(legalActions(state, me).some((a) => a.type === "freeAction" && a.ability === "rebelInc"), "Main action: legal with a card to spare");
  // After the main action, emptying the hand is fine.
  const after = run(state, { type: "playCivil", player: me, instanceId: keep.instanceId }, rng).state;
  assert(after.phase === "action" && after.turn.mainActionDone, "Main action taken, still in the action step");
  const spent = run(after, rebelUse, rng).state;
  assert(spent.players[me].partisans === 1 && spent.players[me].hand.length === 0, "…then Rebel Inc. may spend the whole hand");
}
{
  // Stuck: no main action reachable at all. Draw a card, no free actions, Politics as usual.
  const { state, rng, me } = fresh(521);
  place(state, me, "Rebel Inc.", District.Shavvinne);
  state.players[me].monuments.push(monument(MonumentId.IntelNetwork));
  state.players[me].hand = [];
  const legal = legalActions(state, me);
  assert(!legal.some((a) => a.type === "freeAction"), "Stuck: no free actions at all (Intel Network included)");
  assert(legal.some((a) => a.type === "endAction"), "Stuck: the stuck draw is offered");
  const deckBefore = state.deck.length;
  const next = run(state, { type: "endAction", player: me }, rng).state;
  assert(next.players[me].hand.length === 1 && next.deck.length < deckBefore, "Stuck: draws a card");
  assert(next.phase === "politics" && next.activePlayer === me, "Stuck: Politics follows as usual");
}
{
  // Stuck draw ignores the hand limit: a full hand of alliances that can't be played.
  const { state, rng, me } = fresh(522);
  const alliances = state.deck.filter((card) => getCard(card.cardId).kind === CardKind.Alliance);
  // No "… Inc." alliances: their free actions could open a main action.
  const plain = alliances.filter((card) => !getCard(card.cardId).name.endsWith(" Inc."));
  for (const district of state.districtOrder) {
    const card = plain.find((entry) => printedDistrict(entry.cardId) === district && !state.players[me].hand.includes(entry))!;
    state.deck = state.deck.filter((entry) => entry !== card);
    plain.splice(plain.indexOf(card), 1);
    state.players[me].tableau[district].push({ ...card, faceUp: true, occupiedDistrict: district });
  }
  state.availableMonuments = [];
  const hand = plain.slice(0, handLimit(state, me));
  state.deck = state.deck.filter((entry) => !hand.includes(entry));
  state.players[me].hand = hand.map((card) => ({ ...card, faceUp: true }));
  assert(legalActions(state, me).some((a) => a.type === "endAction"), "Full hand, nothing playable: stuck");
  const next = run(state, { type: "endAction", player: me }, rng).state;
  assert(next.players[me].hand.length === handLimit(state, me) + 1, "Stuck draw goes past the hand limit");
}

report("Free actions and choices ok: Currency Ballots, Urban Aristocrats (any played cards), Kybernetik (after the main action), Foreign Inc., Century Inc., Architecture Inc. (Shavvinne wild), Rebel Inc. (+2 when behind), Capitol Inc. (any district's policy), Intel Network, People's Press, Space Academy, network (Planet Next, Consultative Office), State Enterprise, Diet of Saints, main-action ruling (no dead ends, stuck draw).");
