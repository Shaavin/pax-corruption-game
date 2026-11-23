import { findDeckCards } from "../cards/catalog.ts";
import { District, MonumentId, PolicyId, type DistrictId } from "../cards/schema.ts";
import { allianceLimit, handLimit, isSilenced, alliancesInPlay, policyFrozen } from "./abilities.ts";
import { districtOverride, tallyElection } from "./election.ts";
import { apply, legalActions } from "./engine.ts";
import { playBlockReason } from "./plays.ts";
import { playerDistrictInfluence } from "./influence.ts";
import { policyTargets } from "./senate.ts";
import { newReplay, stepReplay } from "./record.ts";
import type { Action, CardInstance, GameState, PlayerId } from "./types.ts";
import { assert, expectIllegal, playToTurnOne, report, stripElections } from "./test-helpers.ts";

/** Pull a main-deck card (by name + district) out of wherever it sits. */
function take(state: GameState, name: string, district: DistrictId): CardInstance {
  const ids = new Set(findDeckCards({ name, district }).map((card) => card.id));
  const zones = [state.deck, state.market, state.senate, ...state.players.map((seat) => seat.hand)];
  for (const zone of zones) {
    const index = zone.findIndex((card) => ids.has(card.cardId));
    if (index >= 0) return { ...zone.splice(index, 1)[0]!, faceUp: true };
  }
  throw new Error(`${name} (${district}) not found`);
}

function place(state: GameState, player: PlayerId, name: string, district: DistrictId, lane: DistrictId = district) {
  state.players[player].tableau[lane].push({ ...take(state, name, district), occupiedDistrict: lane });
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
  return { state, rng, me: state.activePlayer as PlayerId, them: (1 - state.activePlayer) as PlayerId };
}

// --- Policies -------------------------------------------------------------------
{
  const { state, me } = fresh(401);
  place(state, me, "Farmers", District.Shavvinne); // 3
  place(state, me, "Roman Church", District.Shavvinne); // 9
  assert(playerDistrictInfluence(state, me, District.Shavvinne).total === 12, "Plain Shavvinne influence");
  state.policy[District.Shavvinne] = PolicyId.ShavvinneB; // Secularism
  assert(playerDistrictInfluence(state, me, District.Shavvinne).total === 15, "Secularism doubles civils of 5 or lower");

  state.players[me].support[District.Dragonara] = [take(state, "Tinkers", District.Dragonara), take(state, "Engineers", District.Dragonara)];
  state.policy[District.Dragonara] = PolicyId.DragonaraB; // Populist Forum
  assert(playerDistrictInfluence(state, me, District.Dragonara).support === 4, "Populist Forum: Dragonara discards worth 2");

  place(state, me, "Veterans", District.Horsard); // civil 3
  place(state, me, "Foreign Inc.", District.Horsard); // alliance
  state.policy[District.Horsard] = PolicyId.HorsardA; // Economic Reform
  const horsard = playerDistrictInfluence(state, me, District.Horsard);
  assert(horsard.total === 3 + 6, `Economic Reform: +3 per played card, even alliance (got ${horsard.total})`);
}

{
  const { state, rng, me } = fresh(402);
  state.policy[District.Horsard] = PolicyId.HorsardB; // Market Regulation
  const big = take(state, "Newspapers", District.Horsard); // 8
  const small = take(state, "Veterans", District.Horsard); // 3
  state.players[me].hand = [big, small];
  assert(playBlockReason(state, big.cardId) !== null, "Market Regulation blocks an 8 in Horsard");
  assert(!legalActions(state, me).some((a) => a.type === "playCivil" && a.instanceId === big.instanceId), "…and it isn't offered");
  expectIllegal(() => apply(state, { type: "playCivil", player: me, instanceId: big.instanceId }, rng), "Playing an 8 in Horsard");
  assert(legalActions(state, me).some((a) => a.type === "playCivil" && a.instanceId === small.instanceId), "A 3 is fine");
}

{
  const { state, rng, me } = fresh(403);
  state.policy[District.Shavvinne] = PolicyId.ShavvinneA; // Martial Law
  assert(allianceLimit(state, me, District.Shavvinne) === 0, "Martial Law: −1 alliance limit in Shavvinne");
  assert(allianceLimit(state, me, District.Horsard) === 1, "…other districts unaffected");
  const shav = [take(state, "Farmers", District.Shavvinne), take(state, "Teachers", District.Shavvinne), take(state, "Artisans", District.Shavvinne)];
  state.players[me].hand = shav;
  state.players[me].support[District.Shavvinne] = [take(state, "Architects", District.Shavvinne)];
  expectIllegal(
    () => apply(state, { type: "recruit", player: me, instanceIds: shav.map((c) => c.instanceId) }, rng),
    "Martial Law: recruiting with 3 Shavvinne cards",
  );
  const riot = take(state, "Hub of Assassins", District.Shavvinne);
  assert(playBlockReason(state, riot.cardId) !== null, "Martial Law: a Shavvinne conspiracy is illegal");
}

// --- Alliance limit lowered (ruled 2026-11-18, Joe via Ian) ----------------------
// Report seed 374294586: P1 passed Martial Law while P2 had Foreign Inc. in Shavvinne.
{
  const actions = [
  {"type":"chooseParty","player":0,"partyId":"party-6"},
  {"type":"chooseParty","player":1,"partyId":"party-4"},
  {"type":"chooseStartingHand","player":1,"instanceIds":["horsard-a-3","dragonara-b-10","horsard-b-14"]},
  {"type":"playCivil","player":1,"instanceId":"dragonara-b-10"},
  {"type":"influenceSenate","player":1,"instanceId":"horsard-a-3"},
  {"type":"takeMarket","player":1,"instanceId":"smarbbit-b-1"},
  {"type":"playAlliance","player":0,"instanceId":"smarbbit-a-4"},
  {"type":"endPolitics","player":0},
  {"type":"takeMarket","player":0,"instanceId":"horsard-b-15"},
  {"type":"playCivil","player":1,"instanceId":"smarbbit-b-1"},
  {"type":"influenceSenate","player":1,"instanceId":"smarbbit-b-8"},
  {"type":"takeMarket","player":1,"instanceId":"horsard-b-8"},
  {"type":"playCivil","player":0,"instanceId":"shavvinne-b-3"},
  {"type":"influenceSenate","player":0,"instanceId":"dragonara-b-5"},
  {"type":"takeMarket","player":0,"instanceId":"smarbbit-b-11"},
  {"type":"playCivil","player":1,"instanceId":"horsard-b-14"},
  {"type":"endPolitics","player":1},
  {"type":"takeMarket","player":1,"instanceId":"dragonara-b-12"},
  {"type":"playConspiracy","player":0,"instanceId":"smarbbit-c-2"},
  {"type":"influenceSenate","player":0,"instanceId":"horsard-b-15"},
  {"type":"takeMarket","player":0,"instanceId":"shavvinne-a-1"},
  {"type":"playAlliance","player":1,"instanceId":"shavvinne-a-3"},
  {"type":"influenceSenate","player":1,"instanceId":"horsard-b-8"},
  {"type":"takeMarket","player":1,"instanceId":"dragonara-b-11"},
  {"type":"playCivil","player":0,"instanceId":"horsard-b-12"},
  {"type":"influenceSenate","player":0,"instanceId":"shavvinne-b-17"},
  {"type":"takeMarket","player":0,"instanceId":"horsard-b-5"},
  {"type":"playAlliance","player":1,"instanceId":"dragonara-a-6"},
  {"type":"influenceSenate","player":1,"instanceId":"dragonara-b-12"},
  {"type":"takeMarket","player":1,"instanceId":"horsard-b-7"},
  {"type":"playCivil","player":0,"instanceId":"smarbbit-b-11"},
  {"type":"proposePolicy","player":0,"revealIds":["shavvinne-b-13","horsard-b-5"],"discardId":"shavvinne-b-13","district":"shavvinne","policyId":"shavvinne-a"},
  ] as Action[];
  let replay = newReplay(374294586);
  for (const action of actions.slice(0, -1)) replay = stepReplay(replay, action);
  const before = replay.state;
  assert(before.players[1].tableau[District.Shavvinne].some((card) => card.cardId === "shavvinne-a-3"), "Foreign Inc. sits in P2's Shavvinne lane");
  const result = apply(before, actions.at(-1)!, replay.rng);
  const after = result.state;
  assert(
    !after.players[1].tableau[District.Shavvinne].some((card) => card.cardId === "shavvinne-a-3"),
    "Martial Law discards P2's Shavvinne alliance (limit 1 → 0)",
  );
  assert(
    after.players[1].support[District.Shavvinne].some((card) => card.cardId === "shavvinne-a-3"),
    "…to P2's own Shavvinne support pile",
  );
  assert(
    result.events.some((event) => event.type === "alliancesOverLimit" && event.player === 1 && event.limit === 0),
    "…with an alliancesOverLimit event",
  );
  assert(after.phase === "income" && after.activePlayer === 0 && after.pending.length === 0, "…and P1's turn moves on to income");
}

{
  // Limit 0: every alliance in the lane goes, for both players, with no choice.
  const { state, rng, me, them } = fresh(405);
  place(state, me, "Order of Knights", District.Shavvinne);
  place(state, them, "Foreign Inc.", District.Shavvinne);
  place(state, them, "Foreign Inc.", District.Horsard);
  state.phase = "politics";
  state.turn.mainActionDone = true;
  state.policy[District.Shavvinne] = PolicyId.ShavvinneA;
  const next = apply(state, { type: "endPolitics", player: me }, rng).state;
  for (const seat of [me, them]) {
    assert(next.players[seat].tableau[District.Shavvinne].length === 0, `Martial Law: seat ${seat} keeps no Shavvinne alliance`);
    assert(next.players[seat].support[District.Shavvinne].length === 1, `…seat ${seat}'s goes to their own Shavvinne pile`);
  }
  assert(next.players[them].tableau[District.Horsard].length === 1, "…other districts keep their alliances");
}

{
  // Model Society (limit 2 → 1): the owner picks which alliance goes, even off-turn.
  const { state, rng, me, them } = fresh(406);
  state.players[them].monuments.push(monument(MonumentId.ModelSociety));
  place(state, them, "Order of Knights", District.Shavvinne);
  place(state, them, "Foreign Inc.", District.Shavvinne);
  const [knights, foreign] = state.players[them].tableau[District.Shavvinne];
  state.phase = "politics";
  state.turn.mainActionDone = true;
  state.policy[District.Shavvinne] = PolicyId.ShavvinneA;
  const paused = apply(state, { type: "endPolitics", player: me }, rng).state;
  const choice = paused.pending[0];
  assert(choice?.kind === "trimAlliances" && choice.player === them && choice.count === 1, "Model Society owner over the limit chooses");
  assert(paused.players[them].tableau[District.Shavvinne].length === 2, "…nothing discarded before the choice");
  const options = legalActions(paused, them);
  assert(options.length === 2 && options.every((a) => a.type === "trimAlliances"), "…one option per alliance");
  assert(legalActions(paused, me).length === 0, "…and the active player waits");
  expectIllegal(
    () => apply(paused, { type: "trimAlliances", player: them, instanceIds: [knights!.instanceId, foreign!.instanceId] }, rng),
    "Discarding more than the excess",
  );
  const done = apply(paused, { type: "trimAlliances", player: them, instanceIds: [foreign!.instanceId] }, rng).state;
  assert(
    done.players[them].tableau[District.Shavvinne].map((card) => card.instanceId).join() === knights!.instanceId,
    "…the chosen alliance goes, the other stays",
  );
  assert(done.players[them].support[District.Shavvinne].some((card) => card.instanceId === foreign!.instanceId), "…to their pile");
  assert(done.phase === "income" && done.activePlayer === me && done.pending.length === 0, "…then the turn resumes at income");
}

{
  const { state, rng, me, them } = fresh(404);
  state.policy[District.Smarbbit] = PolicyId.SmarbbitA; // United Front
  state.phase = "politics";
  const card = take(state, "Anarchists", District.Smarbbit);
  state.players[me].hand = [card];
  const smarbbitSenator = take(state, "Radio Stations", District.Smarbbit);
  state.senate[state.senate.length - 1] = smarbbitSenator;
  const before = state.players[them].support[District.Smarbbit].length;
  const next = apply(state, { type: "influenceSenate", player: me, instanceId: card.instanceId }, rng).state;
  assert(
    next.players[them].support[District.Smarbbit].length === before + 1,
    "United Front: your Smarbbit discard lands in the opponent's pile",
  );
}

// --- Alliances --------------------------------------------------------------------
{
  const { state, me, them } = fresh(405);
  place(state, me, "Order of Knights", District.Dragonara);
  place(state, me, "Tinkers", District.Dragonara); // 5
  place(state, me, "Engineers", District.Dragonara); // 5
  assert(playerDistrictInfluence(state, me, District.Dragonara).total === 12, "Order of Knights: +1 per civil");
  const plot = take(state, "Broken Chains", District.Dragonara);
  state.players[them].hand = [plot];
  assert(playBlockReason(state, plot.cardId) !== null, "Order of Knights blocks conspiracies there");

  // A District Governor of Dragonara silences the opponent's Knights there.
  place(state, them, "District Governor", District.Dragonara);
  const knights = alliancesInPlay(state).find((a) => a.owner === me)!;
  assert(isSilenced(state, knights), "Opponent's Governor silences your Knights");
  assert(playerDistrictInfluence(state, me, District.Dragonara).total === 10, "…so no +1s");
  assert(playBlockReason(state, plot.cardId) === null, "…and conspiracies are allowed again");
  assert(policyFrozen(state, District.Dragonara), "A live Governor freezes the district's policy");

}

{
  // Two Dragonara Governors exist: give one to each player.
  const { state, me, them } = fresh(406);
  place(state, me, "District Governor", District.Dragonara);
  place(state, them, "District Governor", District.Dragonara);
  assert(alliancesInPlay(state).every((a) => isSilenced(state, a)), "Opposing Governors silence each other");
  assert(!policyFrozen(state, District.Dragonara), "…and the policy is no longer frozen (FAQ)");
  const technocrats = take(state, "Technocrats", District.Dragonara);
  state.players[me].hand = [technocrats];
  state.senate[0] = take(state, "Tinkers", District.Dragonara); // a Senator the 9 convinces
  assert(
    policyTargets(state, [technocrats.cardId]).some((t) => t.district === District.Dragonara),
    "Dragonara is a proposal target again",
  );
}

{
  const { state, rng, me, them } = fresh(407);
  place(state, me, "Project Habitat", District.Smarbbit);
  place(state, me, "Anarchists", District.Smarbbit);
  place(state, them, "Radio Stations", District.Smarbbit);
  const plot = take(state, "Power Vacuum", District.Smarbbit);
  state.players[them].hand = [plot];
  state.activePlayer = them;
  const next = apply(state, { type: "playConspiracy", player: them, instanceId: plot.instanceId }, rng).state;
  const mine = next.players[me].tableau[District.Smarbbit].map((c) => c.cardId);
  assert(mine.length === 1, `Project Habitat keeps your civils; the alliance itself is wiped (left: ${mine.length})`);
  assert(next.players[them].tableau[District.Smarbbit].length === 0, "The opponent's civil is wiped as usual");
}

// --- Monuments --------------------------------------------------------------------
{
  const { state, rng, me } = fresh(408);
  state.players[me].monuments.push(monument(MonumentId.ModelSociety));
  assert(allianceLimit(state, me, District.Horsard) === 2, "Model Society: 2 alliances per district");
  const a = take(state, "Foreign Inc.", District.Horsard);
  state.players[me].hand = [a];
  const next = apply(state, { type: "playAlliance", player: me, instanceId: a.instanceId }, rng).state;
  assert(next.players[me].hand.length === 1, "Model Society: draw a card when you play an alliance");
}

{
  const { state, rng, me } = fresh(409);
  state.players[me].monuments.push(monument(MonumentId.DragonGate));
  assert(handLimit(state, me) === 7, "Dragon Gate: +2 hand limit");
  // After playing one card from a 3-card hand, income takes 1 and draws 1 → 4, then Dragon Gate draws a 5th.
  const cards = [take(state, "Tinkers", District.Dragonara), take(state, "Engineers", District.Dragonara), take(state, "Gardeners", District.Dragonara)];
  state.players[me].hand = cards;
  let next = apply(state, { type: "playCivil", player: me, instanceId: cards[0]!.instanceId }, rng).state;
  next = apply(next, { type: "endPolitics", player: me }, rng).state;
  next = apply(next, { type: "takeMarket", player: me, instanceId: next.market[0]!.instanceId }, rng).state;
  assert(next.players[me].hand.length === 5, `Dragon Gate draws at exactly 4 (hand ${next.players[me].hand.length})`);
}

// --- Election overrides ------------------------------------------------------------
{
  const { state, me, them } = fresh(410);
  place(state, them, "Roman Church", District.Shavvinne); // 9
  place(state, me, "Diet of Saints", District.Shavvinne);
  assert(districtOverride(state, District.Shavvinne, them) === me, "Diet of Saints wins Shavvinne regardless of influence");
}

{
  const { state, me, them } = fresh(411);
  // Card updated 2026-11-18: "You win Shavvinne during elections if opponent also has an alliance card in Shavvinne."
  place(state, them, "Roman Church", District.Shavvinne);
  place(state, me, "Divine Inquisitors", District.Shavvinne);
  assert(districtOverride(state, District.Shavvinne, them) === them, "Divine Inquisitors: no opponent alliance in Shavvinne, no claim");
  place(state, them, "Rebel Inc.", District.Shavvinne);
  assert(districtOverride(state, District.Shavvinne, them) === me, "…wins once the opponent also has an alliance there");
}

{
  // Joe, 2026-11-22: Divine Inquisitors trumps the opponent's Diet of Saints (they used to cancel).
  // Report seed 1227823536: nobody won Shavvinne (P2 led it 10–4 on influence), and P2 took the election on electors.
  const { state, me, them } = fresh(413);
  place(state, them, "Diet of Saints", District.Shavvinne);
  assert(districtOverride(state, District.Shavvinne, me) === them, "Diet of Saints alone wins Shavvinne");
  place(state, me, "Divine Inquisitors", District.Shavvinne);
  for (const byInfluence of [me, them, null]) {
    assert(
      districtOverride(state, District.Shavvinne, byInfluence) === me,
      `Divine Inquisitors beats the opponent's Diet of Saints (influence leader: ${byInfluence})`,
    );
  }
  assert(tallyElection(state).districts.shavvinne.winner === me, "…in the election tally too");
  // Civil Service still vetoes afterwards: the Inquisitors' owner needs more Shavvinne civils.
  state.players[them].monuments.push(monument(MonumentId.CivilService));
  assert(districtOverride(state, District.Shavvinne, me) === null, "Civil Service still vetoes the Inquisitors' win");
  place(state, me, "Roman Church", District.Shavvinne);
  assert(districtOverride(state, District.Shavvinne, me) === me, "…until they have more civil cards there");
}

{
  // Mirror seat: the same, with the cards swapped between players.
  const { state, me, them } = fresh(414);
  place(state, me, "Diet of Saints", District.Shavvinne);
  place(state, them, "Divine Inquisitors", District.Shavvinne);
  assert(districtOverride(state, District.Shavvinne, me) === them, "Divine Inquisitors beats Diet of Saints for either seat");
}

{
  const { state, me, them } = fresh(412);
  state.players[me].monuments.push(monument(MonumentId.CivilService));
  place(state, me, "Tinkers", District.Dragonara);
  place(state, them, "Technocrats", District.Dragonara);
  assert(districtOverride(state, District.Dragonara, them) === null, "Civil Service: opponent needs more civil cards to win");
  place(state, them, "Gardeners", District.Dragonara);
  assert(districtOverride(state, District.Dragonara, them) === them, "…and wins once they have more");
}

report("Abilities ok: Secularism, Populist Forum, Economic Reform, Market Regulation, Martial Law (and discarding down to a lowered alliance limit), United Front, Order of Knights, District Governor, Project Habitat, Model Society, Dragon Gate, Diet of Saints, Divine Inquisitors, Civil Service.");
