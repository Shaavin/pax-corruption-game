import { getCard } from "../cards/catalog.ts";
import {
  CardKind,
  DecreeId,
  District,
  MonumentId,
  PartyId,
  PolicyId,
  type DistrictId,
} from "../cards/schema.ts";
import {
  apply,
  declarableVictories,
  ideologicalSymbol,
  legalActions,
  otherPlayer,
  printedDistrict,
  senateTotalVotes,
  senateVotesNeeded,
  totalSymbols,
  VictoryKind,
  type CardInstance,
  type GameState,
  type PlayerId,
} from "./index.ts";
import { playerDistrictInfluence } from "./influence.ts";
import {
  assert,
  expectIllegal,
  isKind,
  playToTurnOne,
  report,
  takeFromDeck,
} from "./test-helpers.ts";

/** Pull a specific main-deck card (by name and district) out of wherever it is. */
function pull(state: GameState, name: string, district: DistrictId): CardInstance {
  const zones = [state.deck, state.market, state.senate, ...state.players.map((p) => p.hand)];
  for (const zone of zones) {
    const index = zone.findIndex((card) => {
      const def = getCard(card.cardId);
      return def.name === name && "district" in def && def.district === district;
    });
    if (index >= 0) return { ...zone.splice(index, 1)[0]!, faceUp: true };
  }
  throw new Error(`${name} (${district}) not found`);
}

/** Put the active player straight into their Politics step. */
function toPolitics(state: GameState): GameState {
  state.phase = "politics";
  return state;
}

// --- Alliance -------------------------------------------------------------------
{
  const { state: start, rng } = playToTurnOne(101);
  const actor = start.activePlayer;
  const alliance = takeFromDeck(start, (card) => isKind(card, CardKind.Alliance))[0]!;
  start.players[actor].hand.push(alliance);
  const district = printedDistrict(alliance.cardId);

  const { state } = apply(start, { type: "playAlliance", player: actor, instanceId: alliance.instanceId }, rng);
  assert(
    state.players[actor].tableau[district].some((card) => card.instanceId === alliance.instanceId),
    "Alliance lands in its district",
  );
  assert(playerDistrictInfluence(state, actor, district).civil === 0, "Alliances add no district influence");
  assert(state.turn.mainActionDone, "Alliance play is a main action");

  const second = takeFromDeck(
    state,
    (card) => isKind(card, CardKind.Alliance) && printedDistrict(card.cardId) === district,
  )[0]!;
  const again = { ...state, phase: "action" as const };
  again.players[actor].hand.push(second);
  expectIllegal(
    () => apply(again, { type: "playAlliance", player: actor, instanceId: second.instanceId }, rng),
    "Second alliance in the same district",
  );
}

// --- Conspiracy -------------------------------------------------------------------
{
  const { state: start, rng } = playToTurnOne(111);
  const actor = start.activePlayer;
  const opponent = otherPlayer(actor);
  const conspiracy = takeFromDeck(start, (card) => isKind(card, CardKind.Conspiracy))[0]!;
  const district = printedDistrict(conspiracy.cardId);
  const civils = takeFromDeck(
    start,
    (card) => isKind(card, CardKind.Civil) && printedDistrict(card.cardId) === district,
    2,
  );
  start.players[actor].tableau[district].push(civils[0]!);
  start.players[opponent].tableau[district].push(civils[1]!);
  start.players[actor].hand.push(conspiracy);

  const { state } = apply(start, { type: "playConspiracy", player: actor, instanceId: conspiracy.instanceId }, rng);
  assert(state.players[actor].tableau[district].length === 0, "Conspiracy wipes the actor's lane");
  assert(state.players[opponent].tableau[district].length === 0, "Conspiracy wipes the opponent's lane");
  assert(state.players[opponent].support[district].length === 1, "Wiped cards go to their owner's pile");
  assert(state.players[actor].support[district].length === 2, "Actor's wiped card + the conspiracy");
}

// --- Recruit: precondition, partisans, Military is declared --------------------------
{
  const { state: start, rng } = playToTurnOne(121);
  const actor = start.activePlayer;
  const district = District.Horsard;
  const three = takeFromDeck(
    start,
    (card) => !isKind(card, CardKind.Election) && printedDistrict(card.cardId) === district,
    3,
  );
  start.players[actor].hand = [...three];
  start.players[actor].support[district] = [];

  assert(
    !legalActions(start, actor).some((action) => action.type === "recruit"),
    "Recruit is not offered without a card in that support pile",
  );
  expectIllegal(
    () => apply(start, { type: "recruit", player: actor, instanceIds: three.map((c) => c.instanceId) }, rng),
    "Recruit with an empty support pile",
  );

  const seed = takeFromDeck(start, (card) => isKind(card, CardKind.Civil))[0]!;
  start.players[actor].support[district].push({ ...seed, faceUp: true, occupiedDistrict: district });
  start.players[actor].partisans = 2;
  const { state } = apply(start, { type: "recruit", player: actor, instanceIds: three.map((c) => c.instanceId) }, rng);
  assert(state.players[actor].partisans === 3, "Recruit adds a partisan");
  assert(state.victory === null, "A 3-partisan lead does not end the game by itself");
  assert(state.phase === "politics", "Recruit is a main action");
  assert(
    declarableVictories(state, actor).some((victory) => victory.kind === VictoryKind.Military),
    "Military Victory is declarable at a 3-partisan lead",
  );
  const declared = apply(state, {
    type: "declareVictory",
    player: actor,
    victory: { kind: VictoryKind.Military, player: actor },
  }, rng).state;
  assert(declared.phase === "gameOver" && declared.victory?.kind === VictoryKind.Military, "Declaring ends the game");
}

// --- Construct: claim, replenish, Politics draw ----------------------------------------
{
  const { state: start, rng } = playToTurnOne(131);
  const actor = start.activePlayer;
  const monument = start.availableMonuments[0]!;
  const district = printedDistrict(monument.cardId);
  const five = takeFromDeck(
    start,
    (card) => !isKind(card, CardKind.Election) && printedDistrict(card.cardId) === district,
    5,
  );
  start.players[actor].hand = [...five];
  start.deck = start.deck.filter((card) => !isKind(card, CardKind.Election));

  const built = apply(start, {
    type: "construct",
    player: actor,
    instanceIds: five.map((card) => card.instanceId),
    monumentInstanceId: monument.instanceId,
  }, rng);
  const state = built.state;
  assert(state.players[actor].monuments.some((card) => card.cardId === monument.cardId), "Monument claimed");
  assert(state.availableMonuments.length === 4, "Monument row replenished to 4");
  assert(state.players[actor].support[district].length === 5, "Five cards discarded");
  assert(built.state.turn.mainActionDone, "Construct is a main action");
  // A free action (e.g. Intel Network) can keep the action step open; end it explicitly.
  const politics =
    built.state.phase === "action" ? apply(built.state, { type: "endAction", player: actor }, rng).state : built.state;
  assert(politics.phase === "politics", "Then Politics");
  assert(politics.players[actor].hand.length === 1, "Politics starts with a draw after constructing");
}

// --- Influence Senate ------------------------------------------------------------
{
  const { state: start, rng } = playToTurnOne(141);
  const actor = start.activePlayer;
  toPolitics(start);
  const card = start.players[actor].hand[0]!;
  const rightmost = start.senate[start.senate.length - 1]!;
  const rightDistrict = printedDistrict(rightmost.cardId);
  const pileBefore = start.players[actor].support[rightDistrict].length;

  const { state } = apply(start, { type: "influenceSenate", player: actor, instanceId: card.instanceId }, rng);
  assert(state.senate.length === 5, "Senate stays at 5");
  assert(state.senate[0]!.instanceId === card.instanceId, "New Senator sits leftmost");
  assert(!state.senate.some((entry) => entry.instanceId === rightmost.instanceId), "Rightmost Senator leaves");
  assert(
    state.players[actor].support[rightDistrict].length === pileBefore + 1,
    "Removed Senator goes to the actor's support pile",
  );
  assert(state.phase !== "politics", "Influencing the Senate ends the Politics step");
}

// --- Propose Policy ----------------------------------------------------------------
{
  const { state: start, rng } = playToTurnOne(151);
  const actor = start.activePlayer;
  const d = District.Dragonara;
  start.senate = [
    pull(start, "Tinkers", d), // civil 5, 1 vote
    pull(start, "Dune Clans", d), // civil 4, 1 vote
    pull(start, "Order of Knights", d), // alliance, 2 votes
    pull(start, "Broken Chains", d), // conspiracy, 1 vote
    pull(start, "Masons Guild", District.Horsard), // civil 3, 1 vote
  ];
  const robot = pull(start, "Robot Factories", d); // civil 7
  const enterprise = pull(start, "State Enterprise", d); // alliance
  const fire = pull(start, "Fire Breathers", d); // civil 3
  start.players[actor].hand = [robot, enterprise, fire];
  toPolitics(start);

  assert(senateTotalVotes(start) === 6, `Senate votes ${senateTotalVotes(start)}, want 6`);
  assert(senateVotesNeeded(start) === 4, "More than half of 6 is 4");

  const propose = (
    from: GameState,
    revealIds: string[],
    discardId: string,
    policyId: (typeof PolicyId)[keyof typeof PolicyId] | null,
  ) =>
    apply(from, { type: "proposePolicy", player: actor, revealIds, discardId, district: d, policyId }, rng)
      .state;

  expectIllegal(
    () => propose(start, [robot.instanceId], robot.instanceId, PolicyId.DragonaraA),
    "Robot Factories alone convinces 2 of 6",
  );
  expectIllegal(
    () => propose(start, [fire.instanceId, enterprise.instanceId], fire.instanceId, PolicyId.DragonaraA),
    "A lower civil convinces nobody: 2 of 6",
  );
  expectIllegal(
    () => propose(start, [robot.instanceId, enterprise.instanceId], fire.instanceId, PolicyId.DragonaraA),
    "Discard must be a revealed card",
  );

  {
    // Any district's policy may change, not only the revealed cards' districts (ruled 2026-11-13).
    const elsewhere = apply(start, {
      type: "proposePolicy",
      player: actor,
      revealIds: [robot.instanceId, enterprise.instanceId],
      discardId: enterprise.instanceId,
      district: District.Horsard,
      policyId: PolicyId.HorsardA,
    }, rng).state;
    assert(elsewhere.policy[District.Horsard] === PolicyId.HorsardA, "A Dragonara reveal can change Horsard's policy");
  }

  const passed = propose(start, [robot.instanceId, enterprise.instanceId], enterprise.instanceId, PolicyId.DragonaraA);
  assert(passed.policy[d] === PolicyId.DragonaraA, "One civil convinces two Senators; with the alliance, 4 of 6");
  assert(
    passed.players[actor].support[d].some((card) => card.instanceId === enterprise.instanceId),
    "The chosen revealed card is discarded",
  );
  assert(
    passed.players[actor].hand.some((card) => card.instanceId === robot.instanceId),
    "Other revealed cards return to hand",
  );

  const sideways = structuredClone(start);
  sideways.policy[d] = PolicyId.DragonaraA;
  expectIllegal(
    () => propose(sideways, [robot.instanceId, enterprise.instanceId], enterprise.instanceId, PolicyId.DragonaraB),
    "Side to side skips neutral",
  );
  const back = propose(sideways, [robot.instanceId, enterprise.instanceId], enterprise.instanceId, null);
  assert(back.policy[d] === null, "A side can go back to neutral");
}

// --- Popularity: exactly 9, declared in Politics only -------------------------------
{
  const { state: start, rng } = playToTurnOne(161);
  const actor = start.activePlayer;
  const district = start.districtOrder[0]!;
  const filler = takeFromDeck(start, (card) => isKind(card, CardKind.Civil), 9);
  start.players[actor].support[district] = filler.slice(0, 8).map((card) => ({ ...card, faceUp: true }));
  toPolitics(start);
  assert(
    !declarableVictories(start, actor).some((v) => v.kind === VictoryKind.Popularity),
    "8 more support is not enough",
  );
  start.players[actor].support[district].push({ ...filler[8]!, faceUp: true });
  const victory = declarableVictories(start, actor).find((v) => v.kind === VictoryKind.Popularity);
  assert(victory?.district === district, "9 more support in one district is declarable");

  const inAction = { ...structuredClone(start), phase: "action" as const };
  expectIllegal(
    () => apply(inAction, { type: "declareVictory", player: actor, victory: victory! }, rng),
    "Victories are declared only in the Politics step",
  );
  const done = apply(start, { type: "declareVictory", player: actor, victory: victory! }, rng).state;
  assert(done.victory?.kind === VictoryKind.Popularity, "Popularity declared");
}

// --- Ideological: the rulebook example ------------------------------------------------
{
  const { state } = playToTurnOne(171);
  const p1: PlayerId = 0;
  const p2: PlayerId = 1;
  const monument = (id: string) => ({ instanceId: id, cardId: id, faceUp: true });
  state.players[p1].partyId = PartyId.Innovative; // atom
  state.players[p2].partyId = PartyId.Progressive; // atom
  state.players[p1].monuments = [monument(MonumentId.SpaceAgency)]; // atom
  state.players[p2].monuments = [monument(MonumentId.ModelSociety)]; // scales
  state.policy[District.Shavvinne] = PolicyId.ShavvinneB; // Secularism, scales
  state.policy[District.Smarbbit] = PolicyId.SmarbbitA; // United Front, scales
  state.policy[District.Dragonara] = PolicyId.DragonaraA; // Currency Ballots, atom
  state.policy[District.Horsard] = null;
  for (const decree of state.decrees) {
    decree.active = decree.id === DecreeId.Profectus || decree.id === DecreeId.DeJures;
  }
  const totals = totalSymbols(state);
  assert(totals.crown === 0 && totals.chart === 1, "Crown 0, chart 1");
  assert(totals.atom === 3, `Atom ${totals.atom}, want 3 (Player 2's private atom ignored)`);
  assert(totals.scales === 4, `Scales ${totals.scales}, want 4`);
  assert(ideologicalSymbol(state, p2) === "scales", "Player 2 can declare with scales");
  assert(ideologicalSymbol(state, p1) === null, "Player 1 cannot declare");

  // A third private atom for Player 1 makes atom 4, tying scales: no ties allowed.
  state.players[p1].monuments.push(monument(MonumentId.IntelNetwork));
  assert(ideologicalSymbol(state, p2) === null, "A tie for most copies blocks Ideological");
  assert(ideologicalSymbol(state, p1) === null, "…for both players");

  // Smart Doctrine: one private copy per active decree's symbol.
  state.players[p2].monuments.push(monument(MonumentId.SmartDoctrine));
  const withDoctrine = totalSymbols(state);
  assert(withDoctrine.scales === 5, `Smart Doctrine adds De Jures' scales: ${withDoctrine.scales}`);
  assert(ideologicalSymbol(state, p2) === "scales", "Smart Doctrine breaks the tie for Player 2");
}

// --- Political: two satisfied active decrees ---------------------------------------
{
  const { state } = playToTurnOne(181);
  const actor = state.activePlayer;
  state.players[actor].partisans = 1; // Imperium
  const filler = takeFromDeck(state, (card) => isKind(card, CardKind.Civil), 7);
  state.players[actor].support[District.Horsard] = filler.map((card) => ({ ...card, faceUp: true })); // Profectus
  toPolitics(state);
  assert(
    !declarableVictories(state, actor).some((v) => v.kind === VictoryKind.Political),
    "Inactive decrees don't count",
  );
  for (const decree of state.decrees) {
    decree.active = decree.id === DecreeId.Imperium || decree.id === DecreeId.Profectus;
  }
  assert(
    declarableVictories(state, actor).some((v) => v.kind === VictoryKind.Political),
    "Two satisfied active decrees: Political Victory",
  );
}

report("Actions ok: alliance, conspiracy, recruit precondition, construct draw, Senate, Propose Policy, declared victories, ideological, political.");
