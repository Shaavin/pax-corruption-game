import { findDeckCards } from "../cards/catalog.ts";
import { District, MonumentId, PolicyId, type DistrictId } from "../cards/schema.ts";
import { allianceLimit, handLimit, isSilenced, alliancesInPlay, policyFrozen } from "./abilities.ts";
import { districtOverride } from "./election.ts";
import { apply, legalActions } from "./engine.ts";
import { playBlockReason } from "./plays.ts";
import { playerDistrictInfluence } from "./influence.ts";
import { policyTargets } from "./senate.ts";
import type { CardInstance, GameState, PlayerId } from "./types.ts";
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
  state.players[me].hand = [take(state, "Technocrats", District.Dragonara)];
  assert(
    policyTargets(state).some((t) => t.district === District.Dragonara),
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
  place(state, them, "Roman Church", District.Shavvinne);
  place(state, me, "Divine Inquisitors", District.Shavvinne);
  assert(districtOverride(state, District.Shavvinne, them) === me, "Divine Inquisitors wins as the only alliance there");
  place(state, them, "Rebel Inc.", District.Shavvinne);
  assert(districtOverride(state, District.Shavvinne, them) === them, "…not once another alliance is there");
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

report("Abilities ok: Secularism, Populist Forum, Economic Reform, Market Regulation, Martial Law, United Front, Order of Knights, District Governor, Project Habitat, Model Society, Dragon Gate, Diet of Saints, Divine Inquisitors, Civil Service.");
