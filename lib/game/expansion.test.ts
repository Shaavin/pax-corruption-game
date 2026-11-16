/** Legacy & Diplomacy: setup, the event Market, buying, every event effect, victories, election rows. */
import { getCard } from "../cards/catalog.ts";
import { EVENTS, getEvent, WORLD_POWERS, type EventCard } from "../cards/expansion.ts";
import { CardKind, DecreeId, District, MonumentId, PolicyId, type DistrictId } from "../cards/schema.ts";
import { simulate } from "./diagnostics.ts";
import { eventCost, liveEventCost, marketRows, openElectionIfNeeded, removeFromMarket, replenishMarket, resetMarketAfterElection, snapshotMarket } from "./draw.ts";
import { apply, currentActor, legalActions } from "./engine.ts";
import { handLimit } from "./abilities.ts";
import { buyEventActions, returnUnrevealedCards } from "./events.ts";
import { freeActions } from "./free-actions.ts";
import { playerDistrictInfluence } from "./influence.ts";
import { canRecruitIn } from "./main.ts";
import { newReplay, replayRecord, stepReplay, toRecord, type Replay } from "./record.ts";
import { convincedSenators, proposalDistricts } from "./senate.ts";
import { activeDecrees, inactiveDecrees } from "./decrees.ts";
import { createSeededRng } from "./rng.ts";
import { Phase, VictoryKind, type CardInstance, type GameEvent, type GameState, type PlayerId } from "./types.ts";
import { declarableVictories, militaryLead, privateSymbols, sharedSymbols } from "./victory.ts";
import { isEventCard, supportCount } from "./world.ts";
import { assert, expectIllegal, report } from "./test-helpers.ts";

const rng = createSeededRng(99);
const chooser = createSeededRng(4242);

function start(seed: number, foreignInfluence = false): Replay {
  let replay = newReplay(seed, { expansion: true, foreignInfluence });
  while (replay.state.phase === Phase.Setup) {
    replay = stepReplay(replay, legalActions(replay.state, currentActor(replay.state))[0]!);
  }
  return replay;
}

const event = (name: string): EventCard => EVENTS.find((entry) => entry.name === name)!;
const inst = (def: EventCard): CardInstance => ({ instanceId: `ev-${def.id}`, cardId: def.id, faceUp: true });

/** Put an event into effect directly (bypassing the Market), owned by `owner`. */
function inEffect(state: GameState, name: string, owner: PlayerId | null = 0): void {
  state.expansion!.commonArea.push({ card: inst(event(name)), owner });
}

function card(state: GameState, predicate: (id: string) => boolean): CardInstance {
  const index = state.deck.findIndex((entry) => predicate(entry.cardId));
  return state.deck.splice(index, 1)[0]!;
}
const civilOf = (district: DistrictId, value?: number) => (id: string) => {
  const def = getCard(id);
  return def.kind === CardKind.Civil && def.district === district && (value === undefined || def.influence === value);
};

// --- Setup --------------------------------------------------------------------------------
{
  const { state } = start(1);
  const x = state.expansion!;
  assert(x.eventDeck.length === 28, `Event deck 28, got ${x.eventDeck.length}`);
  assert(x.box.length === 12, `12 events removed at setup, got ${x.box.length}`);
  assert(x.eventDeck.filter((c) => getEvent(c.cardId).legacy).length === 8, "All 8 legacy events are in the deck");
  for (const power of WORLD_POWERS) {
    const removed = x.box.filter((c) => getEvent(c.cardId).power === power);
    assert(removed.length === 3 && removed.every((c) => !getEvent(c.cardId).legacy), `3 regular ${power} events removed`);
  }
  assert(x.activeVictories.length === 0, "Expansion victories start inactive");
  assert(state.market.length === 5 && !state.market.some(isEventCard), "Market starts with 5 non-event cards");
  const fi = start(1, true).state.expansion!;
  assert(fi.commonArea.length === 3 && fi.commonArea.every((p) => p.owner === null), "Foreign Influence: 3 events in play, no owner");
  assert(fi.eventDeck.length === 28, "Foreign Influence: the event deck is still 20 regular + 8 legacy");
  // The 3 come from the 12 removed events (Ian, 2026-11-15); the other 9 stay in the box.
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const setup = start(seed, true).state.expansion!;
    const plain = start(seed, false).state.expansion!;
    const startedIds = setup.commonArea.map((p) => p.card.cardId);
    assert(setup.box.length === 9, `Foreign Influence: 9 removed events stay in the box (seed ${seed})`);
    assert(startedIds.every((id) => !getEvent(id).legacy), "Foreign Influence: never a legacy event");
    const removedIds = new Set([...startedIds, ...setup.box.map((c) => c.cardId)]);
    for (const power of WORLD_POWERS) {
      assert([...removedIds].filter((id) => getEvent(id).power === power).length === 3, `3 ${power} events removed (seed ${seed})`);
    }
    assert(!setup.eventDeck.some((c) => startedIds.includes(c.cardId)), "Foreign Influence: starting events aren't in the deck");
    assert(
      plain.eventDeck.map((c) => c.cardId).join() === setup.eventDeck.map((c) => c.cardId).join(),
      "Foreign Influence doesn't change the event deck",
    );
  }
  // Base games are untouched.
  assert(newReplay(1).state.expansion === null, "Base game has no expansion state");
}

// --- Victories inactive / activated ---------------------------------------------------------
{
  const { state } = start(2);
  state.players[0].partisans = 5;
  state.players[1].partisans = 0;
  assert(!declarableVictories(state, 0).some((v) => v.kind === VictoryKind.Military), "Military is inactive until activated");
  state.expansion!.activeVictories.push("military");
  assert(declarableVictories(state, 0).some((v) => v.kind === VictoryKind.Military), "Activated Military can be declared");
  inEffect(state, "Morph Wizards");
  inEffect(state, "Neighborhoods");
  assert(militaryLead(state) === 5, `Military +1 events stack (3 + 2), got ${militaryLead(state)}`);
  state.players[0].partisans = 4;
  assert(!declarableVictories(state, 0).some((v) => v.kind === VictoryKind.Military), "Lead of 4 < 5 needed");

  state.expansion!.activeVictories.push("cultural", "diplomatic");
  state.players[0].monuments = [{ instanceId: "m1", cardId: MonumentId.DragonGate, faceUp: true }, { instanceId: "m2", cardId: MonumentId.IntelNetwork, faceUp: true }];
  state.players[1].monuments = [];
  assert(declarableVictories(state, 0).some((v) => v.kind === VictoryKind.Cultural), "Cultural: 2+ more monuments");
  state.expansion!.relations[0] = { north: 2, south: 1, east: 1, west: 0 };
  state.expansion!.relations[1] = { north: 1, south: 0, east: 0, west: 0 };
  assert(declarableVictories(state, 0).some((v) => v.kind === VictoryKind.Diplomatic), "Diplomatic: higher with 3 of 4");
  state.expansion!.relations[1].east = 1;
  assert(!declarableVictories(state, 0).some((v) => v.kind === VictoryKind.Diplomatic), "A tie doesn't count as higher");
  // Civil and Political are always active.
  assert(newReplay(3).state.expansion === null, "sanity");
}

// --- West, South, North effects --------------------------------------------------------------
{
  const { state } = start(4);
  const horsard = state.players[0].support[District.Horsard];
  horsard.push(card(state, civilOf(District.Horsard)), card(state, civilOf(District.Horsard)));
  state.players[0].tableau[District.Horsard].push(card(state, civilOf(District.Horsard)));
  const before = playerDistrictInfluence(state, 0, District.Horsard).total;
  assert(supportCount(state, 0, District.Horsard) === 2 && canRecruitIn(state, 0, District.Horsard), "Support 2 before");
  inEffect(state, "Agents in Power"); // West: Horsard support remains at zero
  assert(supportCount(state, 0, District.Horsard) === 0, "West: support counts as 0");
  assert(!canRecruitIn(state, 0, District.Horsard), "West: no Recruit precondition with zeroed support");
  assert(playerDistrictInfluence(state, 0, District.Horsard).total === before - 2, "West: influence loses the support");
  state.expansion!.commonArea = [];
  inEffect(state, "Migrant Voters"); // South: Horsard influence reduced to support
  assert(playerDistrictInfluence(state, 0, District.Horsard).total === 2, "South: influence equals support");

  // South drops Populist Forum's doubling too: strictly the support count (Joe, 2026-11-15).
  state.expansion!.commonArea = [];
  state.policy[District.Dragonara] = PolicyId.DragonaraB; // Populist Forum
  state.players[0].support[District.Dragonara].push(card(state, civilOf(District.Dragonara)), card(state, civilOf(District.Dragonara)));
  const doubled = playerDistrictInfluence(state, 0, District.Dragonara).support;
  assert(doubled === 2 * supportCount(state, 0, District.Dragonara), "Populist Forum doubles support influence");
  inEffect(state, "Digital Electors"); // South: Dragonara influence reduced to support
  assert(
    playerDistrictInfluence(state, 0, District.Dragonara).total === supportCount(state, 0, District.Dragonara),
    "South: Populist Forum's doubling drops out",
  );
  state.policy[District.Dragonara] = null;

  // South: that district's civil and alliance Senators are convinced; conspiracies never (2026-11-15).
  state.expansion!.commonArea = [];
  const byName = (name: string) => card(state, (id) => getCard(id).name === name);
  state.senate = [byName("Tinkers"), byName("Broken Chains"), ...state.senate.slice(2)];
  assert(!convincedSenators(state, []).includes(0), "Nothing convinced without a reveal");
  inEffect(state, "Thunder Bail-out"); // South: Dragonara Senators always convinced
  const convinced = convincedSenators(state, []);
  assert(convinced.includes(0), "South: a Dragonara civil Senator is always convinced");
  assert(!convinced.includes(1), "South: a Dragonara conspiracy Senator still isn't");
  // Proposal districts follow the convinced Senators (Joe, 2026-11-15): South opens Dragonara
  // even when no Dragonara card is revealed.
  const unrelated = card(state, civilOf(District.Horsard));
  assert(proposalDistricts(state, [unrelated.cardId]).has(District.Dragonara), "South-convinced Senator opens its district");

  // North: decree flips while in effect, activation flips the printed side.
  state.expansion!.commonArea = [];
  assert(!activeDecrees(state).includes(DecreeId.Academia), "Academia starts inactive");
  inEffect(state, "Science Guild");
  assert(activeDecrees(state).includes(DecreeId.Academia), "North: Academia shows active while flipped");
  assert(!inactiveDecrees(state).includes(DecreeId.Academia), "…so it can't be activated");
  state.expansion!.commonArea = [];
  assert(!activeDecrees(state).includes(DecreeId.Academia), "Flips back when the event leaves");
}

// --- West icons ---------------------------------------------------------------------------------
{
  const { state } = start(5);
  const party = state.players[0].partyId!;
  const partyMonumentDistrict = (getCard((getCard(party) as { guaranteedMonumentId: string }).guaranteedMonumentId) as { district: DistrictId }).district;
  const symbolsBefore = Object.values(privateSymbols(state, 0)).reduce((a, b) => a + b, 0);
  const west = EVENTS.find((e) => !e.legacy && e.effect.type === "disableIcons" && e.effect.district === partyMonumentDistrict)!;
  inEffect(state, west.name);
  const symbolsAfter = Object.values(privateSymbols(state, 0)).reduce((a, b) => a + b, 0);
  assert(symbolsAfter === symbolsBefore - 1, "West: the party symbol of that district's color stops counting");
  state.policy[District.Smarbbit] = PolicyId.SmarbbitA;
  const shared = Object.values(sharedSymbols(state)).reduce((a, b) => a + b, 0);
  inEffect(state, "Social Corporatism"); // Smarbbit icons
  assert(Object.values(sharedSymbols(state)).reduce((a, b) => a + b, 0) === shared - 1, "West: the district's policy symbol stops counting");
}

// --- The Market: event arrival, cost, last-2 removal, buying ------------------------------------
{
  let replay = start(6);
  // Play turns until an event shows up in the Market.
  for (let i = 0; i < 6 && !replay.state.market.some(isEventCard); i++) replay = plainTurn(replay);
  const state = replay.state;
  const ev = state.market.find(isEventCard);
  assert(ev, "An event enters the Market at the first income refill");
  assert(state.market.filter(isEventCard).length <= 2, "At most 2 events in the Market");
  const index = state.market.indexOf(ev!);
  const live = state.market.slice(index + 1).filter((c) => !isEventCard(c)).length;
  assert(eventCost(state, ev!.instanceId) === live, "Cost = non-event cards to its right");
}

// A later event in the row never adds to an earlier event's cost.
{
  const { state } = start(14);
  const first = inst(event("Railway Bonds"));
  const second = inst(event("Private Islands"));
  const mains = state.market.filter((c) => !isEventCard(c)).slice(0, 3);
  state.market = [mains[0]!, first, mains[1]!, second, mains[2]!];
  snapshotMarket(state);
  assert(eventCost(state, first.instanceId) === 2, `Earlier event: 2 main cards to its right, the later event not counted (got ${eventCost(state, first.instanceId)})`);
  assert(eventCost(state, second.instanceId) === 1, "Later event: 1 main card to its right");
}

// Buy for effect: relation, payment to support piles, draw a card.
{
  const { state } = start(7);
  const def = event("Migrant Voters");
  const evCard = inst(def);
  state.expansion!.eventDeck = state.expansion!.eventDeck.filter((c) => c.cardId !== def.id);
  state.market.splice(2, 0, evCard); // two non-event cards to its right
  snapshotMarket(state);
  const me = state.activePlayer;
  state.phase = Phase.Income;
  state.players[me].hand = state.players[me].hand.slice(0, 3);
  const pay = state.players[me].hand.slice(0, 3).map((c) => c.instanceId);
  assert(eventCost(state, evCard.instanceId) === 3, `Cost 3, got ${eventCost(state, evCard.instanceId)}`);
  expectIllegal(() => apply(state, { type: "buyEvent", player: me, instanceId: evCard.instanceId, payIds: pay.slice(0, 2), use: "effect" }, rng), "Underpaying");
  const supportBefore = Object.values(state.players[me].support).flat().length;
  const out = apply(state, { type: "buyEvent", player: me, instanceId: evCard.instanceId, payIds: pay, use: "effect" }, rng).state;
  const x = out.expansion!;
  assert(x.commonArea.some((p) => p.card.cardId === def.id && p.owner === me), "Bought event is in the common area");
  assert(x.relations[me].south === 1, "+1 South relation");
  const supportAfter = Object.values(out.players[me].support).flat().length;
  assert(supportAfter >= supportBefore + 3 || out.pending.length > 0, "Payment goes to support piles");
  assert(out.players[me].hand.length >= 1, "Effect purchase draws a card");
}

// Buy as civil: it lands in the buyer's lane as a civil card with its value; a conspiracy discard boxes it.
{
  const { state } = start(8);
  const def = event("World Factory") as Extract<EventCard, { legacy: false }>;
  const evCard = inst(def);
  state.expansion!.eventDeck = state.expansion!.eventDeck.filter((c) => c.cardId !== def.id);
  state.market.push(evCard);
  snapshotMarket(state);
  const me = state.activePlayer;
  state.phase = Phase.Income;
  state.players[me].hand = state.players[me].hand.slice(0, 2);
  const out = apply(state, { type: "buyEvent", player: me, instanceId: evCard.instanceId, payIds: [], use: "civil" }, rng).state;
  const lane = out.players[me].tableau[District.Dragonara];
  assert(lane.some((c) => c.cardId === def.id), "Civil side lands in its district");
  const civil = getCard(def.id);
  assert(civil.kind === CardKind.Civil && civil.influence === 11 && civil.name === "Kawasaki Energy", "Catalogued as its civil side");
  assert(playerDistrictInfluence(out, me, District.Dragonara).civil >= 11, "Counts its value as influence");
}

// Legacy: activate a victory; discard that power's events everywhere (into the box).
{
  const { state } = start(9);
  const me = state.activePlayer;
  inEffect(state, "Railway Bonds", 1);
  state.players[me].tableau[District.Horsard].push(inst(event("Private Islands")));
  const legacyDef = EVENTS.find((e) => e.legacy && e.power === "east")!;
  const legacyCard = inst(legacyDef);
  state.expansion!.eventDeck = state.expansion!.eventDeck.filter((c) => c.cardId !== legacyDef.id);
  state.market.push(legacyCard);
  snapshotMarket(state);
  state.phase = Phase.Income;
  state.players[me].hand = state.players[me].hand.slice(0, 2);
  const uses = buyEventActions(state, me).filter((a) => a.instanceId === legacyCard.instanceId).map((a) => a.use + (a.victory ?? ""));
  assert(uses.includes("legacyDiscard") && uses.includes("legacyActivatediplomatic"), "Legacy offers discard or activation");
  const activated = apply(state, { type: "buyEvent", player: me, instanceId: legacyCard.instanceId, payIds: [], use: "legacyActivate", victory: "diplomatic" }, rng).state;
  assert(activated.expansion!.activeVictories.includes("diplomatic"), "Legacy activates the chosen victory");
  assert(activated.expansion!.box.some((c) => c.cardId === legacyDef.id), "Legacy events leave the game once played");
  const discarded = apply(state, { type: "buyEvent", player: me, instanceId: legacyCard.instanceId, payIds: [], use: "legacyDiscard" }, rng).state;
  assert(!discarded.expansion!.commonArea.some((p) => getEvent(p.card.cardId).power === "east"), "East effects removed");
  assert(!discarded.players[me].tableau[District.Horsard].some(isEventCard), "East civil-side events removed from lanes");
  assert(discarded.expansion!.box.some((c) => c.cardId === event("Private Islands").id), "…into the box, not a support pile");
}

// Only events left at income (Ian, 2026-11-15): an affordable one must be bought; if none is,
// the player loses the Market take but still draws from the deck.
{
  const setUp = (seed: number, handSize: number) => {
    const { state } = start(seed);
    const me = state.activePlayer;
    const ev = inst(event("Magic Realms"));
    state.expansion!.eventDeck = state.expansion!.eventDeck.filter((c) => c.cardId !== ev.cardId);
    const mains = state.market.filter((c) => !isEventCard(c)).slice(0, 2);
    state.market = [ev, ...mains];
    snapshotMarket(state); // costs 2 for the whole turn
    state.market = [ev]; // both main cards left the Market during the turn (East take, State Enterprise)
    state.players[me].hand = state.players[me].hand.slice(0, handSize);
    state.phase = Phase.Politics;
    return { state, me, ev };
  };
  {
    const { state, me, ev } = setUp(18, 3);
    const out = apply(state, { type: "endPolitics", player: me }, rng).state;
    assert(out.phase === Phase.Income, "Only events, one affordable: income stops for the purchase");
    const options = legalActions(out, me).filter((a) => a.type !== "setAside");
    assert(options.length > 0 && options.every((a) => a.type === "buyEvent" && a.instanceId === ev.instanceId), "…and buying it is the only way on");
  }
  {
    const { state, me } = setUp(19, 1);
    const handBefore = state.players[me].hand.length;
    const out = apply(state, { type: "endPolitics", player: me }, rng).state;
    assert(out.activePlayer !== me, "Only events, none affordable: no Market take, the turn moves on");
    assert(out.players[me].hand.length === handBefore + 1, "…but the player still draws from the deck");
  }
}

// South alone convinces a majority (Ian, 2026-11-15): propose with nothing revealed or discarded.
{
  const { state } = start(20);
  const me = state.activePlayer;
  const byName = (name: string) => card(state, (id) => getCard(id).name === name);
  state.senate = ["Tinkers", "Dune Clans", "Gardeners", "Runes Tavern", "Fire Breathers"].map(byName);
  state.policy[District.Dragonara] = null;
  state.phase = Phase.Politics;
  const handBefore = state.players[me].hand.length;
  const noReveal = { type: "proposePolicy" as const, player: me, revealIds: [], discardId: null, district: District.Dragonara, policyId: PolicyId.DragonaraA };
  expectIllegal(() => apply(state, noReveal, rng), "Without South, a proposal needs revealed cards");
  inEffect(state, "Thunder Bail-out"); // South: Dragonara Senators always convinced
  assert(legalActions(state, me).some((a) => a.type === "proposePolicy" && a.revealIds.length === 0 && a.discardId === null), "South majority: a no-reveal proposal is offered");
  const out = apply(state, noReveal, rng).state;
  assert(out.policy[District.Dragonara] === PolicyId.DragonaraA, "…and changes the policy");
  assert(out.players[me].hand.length === handBefore, "…with no card discarded");
  expectIllegal(
    () => apply(state, { ...noReveal, discardId: state.players[me].hand[0]!.instanceId }, rng),
    "Nothing revealed, so nothing to discard",
  );
}

// Buying needs room in hand.
{
  const { state } = start(10);
  const def = event("Magic Realms");
  state.market.push(inst(def));
  snapshotMarket(state);
  state.phase = Phase.Income;
  const me = state.activePlayer;
  while (state.players[me].hand.length < 5) state.players[me].hand.push(state.deck.shift()!);
  assert(buyEventActions(state, me).length === 0, "No buying at the hand limit");
}

// --- East ---------------------------------------------------------------------------------------
{
  const { state } = start(11);
  const me = state.activePlayer;
  inEffect(state, "Private Islands", me); // Horsard revealed cards outside the hand limit
  const horsardCard = card(state, civilOf(District.Horsard));
  state.players[me].hand.push(horsardCard);
  const setAside = legalActions(state, me).find((a) => a.type === "setAside" && a.zone === "eastReveal");
  assert(setAside, "East: Horsard cards can be revealed (set aside)");
  const out = apply(state, setAside!, rng).state;
  assert(out.expansion!.revealed[me].length === 1, "Revealed zone holds the card");
  assert(legalActions(out, me).some((a) => a.type === "playCivil" && a.instanceId === horsardCard.instanceId), "Revealed cards are usable as if in hand");
  // Not the opponent's: East is exclusive.
  assert(!legalActions(out, me === 0 ? 1 : 0).some((a) => a.type === "setAside" && a.zone === "eastReveal"), "East is exclusive to its buyer");

  // Confirmed with Joe (2026-11-14): if the East event leaves play, revealed cards go straight
  // back to the hand, even past the hand limit. No discard; income draws wait until under it.
  const over = structuredClone(out);
  while (over.players[me].hand.length < handLimit(over, me)) over.players[me].hand.push(over.deck.shift()!);
  over.expansion!.commonArea = [];
  returnUnrevealedCards(over);
  assert(over.expansion!.revealed[me].length === 0, "East gone: revealed zone empties");
  assert(over.players[me].hand.some((c) => c.instanceId === horsardCard.instanceId), "…back into hand");
  assert(over.players[me].hand.length === handLimit(over, me) + 1, "…past the hand limit, with no discard");
  over.phase = Phase.Income;
  const marketCard = over.market.find((c) => !isEventCard(c))!;
  expectIllegal(() => apply(over, { type: "takeMarket", player: me, instanceId: marketCard.instanceId }, rng), "Income take while over the limit");

  const take = structuredClone(state);
  take.expansion!.commonArea = [];
  inEffect(take, "Railway Bonds", me);
  const target = card(take, civilOf(District.Horsard));
  take.market.push(target);
  take.players[me].hand = take.players[me].hand.slice(0, 3);
  const free = freeActions(take, me).find((a) => a.ability === "eastTake" && a.instanceId === target.instanceId);
  assert(free && free.ability === "eastTake" && free.instanceId === target.instanceId, "East: free action takes a Horsard Market card");
  const took = apply(take, free!, rng).state;
  assert(took.players[me].hand.some((c) => c.instanceId === target.instanceId), "…into hand");
  assert(!freeActions(took, me).some((a) => a.ability === "eastTake"), "Once per turn");

  // Main-action ruling (2026-11-14): an empty hand isn't stuck while East can take a playable card.
  const empty = structuredClone(take);
  empty.players[me].hand = [];
  const emptyLegal = legalActions(empty, me);
  assert(!emptyLegal.some((a) => a.type === "endAction"), "Main action reachable via East: no stuck draw");
  assert(emptyLegal.some((a) => a.type === "freeAction" && a.ability === "eastTake"), "…the East take is offered");
}

// --- "Last 2 spots" on a full Market (Joe, 2026-11-15) ----------------------------------------
{
  // Even with 5 cards, the income refill checks the last 2 spots, collapses, and refills to 5.
  const { state } = start(16);
  const stale = inst(event("Railway Bonds"));
  state.expansion!.eventDeck = state.expansion!.eventDeck.filter((c) => c.cardId !== stale.cardId);
  const mains = state.market.filter((c) => !isEventCard(c)).slice(0, 4);
  state.market = [...mains, stale];
  snapshotMarket(state); // the event starts the turn in spot 5
  replenishMarket(state, []);
  const after: CardInstance[] = [...state.market];
  assert(state.expansion!.box.some((c) => c.cardId === stale.cardId), "Full Market: the spot-5 event still leaves");
  // Conveyor (Ian, 2026-11-16): the older cards slide right; the new event enters at spot 1.
  assert(mains.every((card, index) => after[index + 1] === card), "…the rest slide right, in order");
  assert(isEventCard(after[0]!) && eventCost(state, after[0]!.instanceId) === 4, "…a new event enters at spot 1 (costs 4)");
  assert(after.length === 5, `…and the Market refills to exactly 5, got ${after.length}`);

  // Nothing to remove and already 5: no sixth card, not even an event.
  const full = start(17).state;
  full.market = full.market.filter((c) => !isEventCard(c)).slice(0, 5);
  snapshotMarket(full);
  replenishMarket(full, []);
  assert(full.market.length === 5 && !full.market.some(isEventCard), "Never past 5 cards");
}

// --- Conveyor: cards enter on the left and drift right (Ian, 2026-11-16) -----------------------
{
  const { state } = start(21);
  const first = inst(event("Railway Bonds"));
  state.expansion!.eventDeck = state.expansion!.eventDeck.filter((c) => c.cardId !== first.cardId);
  const mains = state.market.filter((c) => !isEventCard(c)).slice(0, 4);
  state.market = [first, ...mains];
  snapshotMarket(state);
  assert(eventCost(state, first.instanceId) === 4, "A new event at spot 1 costs 4");
  // Two main cards are taken this turn; at the refill the rest slide right and new cards enter left.
  removeFromMarket(state, mains[2]!.instanceId);
  removeFromMarket(state, mains[3]!.instanceId);
  replenishMarket(state, []);
  const row: CardInstance[] = [...state.market];
  assert(row.length === 5, "Back to 5 cards");
  assert(row.indexOf(first) === 2, `The older event drifted right to spot 3 (index ${row.indexOf(first)})`);
  assert(liveEventCost(state, first.instanceId) === 2, "…and now costs 2 (2 main cards to its right)");
  assert(isEventCard(row[0]!) && row[0] !== first, "A newer event entered at spot 1");
}

// --- Market after an election (Ian, 2026-11-15) ---------------------------------------------
{
  // Leftover events leave the game; nothing stays; then the normal refill.
  const { state } = start(13);
  const leftovers = [inst(event("Railway Bonds")), inst(event("Private Islands"))];
  state.expansion!.eventDeck = state.expansion!.eventDeck.filter((c) => !leftovers.some((l) => l.cardId === c.cardId));
  state.market = [...leftovers];
  state.expansion!.rowBreak = 1;
  state.election.active = false;
  const events: GameEvent[] = [];
  resetMarketAfterElection(state, events);
  assert(state.market.length === 0 && state.expansion!.rowBreak === null, "After an election: the Market is wiped, one row");
  assert(leftovers.every((l) => state.expansion!.box.some((c) => c.cardId === l.cardId)), "…leftover events leave the game");
  replenishMarket(state, events);
  const refilled: CardInstance[] = [...state.market];
  assert(refilled.length === 5, "…then refills to 5 like any income");
  assert(refilled.filter(isEventCard).length === 1 && isEventCard(refilled[0]!), "…one new event, in the next (first) spot");
  assert(eventCost(state, refilled[0]!.instanceId) === 4, "…so it costs 4, not 0 (the event is first, not last)");
}

// --- Election rows ------------------------------------------------------------------------------
{
  // Two events when an election opens (Ian, 2026-11-15): events in spots 2 and 3. The later one
  // (spot 2, further left) drops to spot 2 of row 2; nothing else moves; open spots fill in place.
  const { state } = start(15);
  const later = inst(event("Railway Bonds"));
  const earlier = inst(event("Private Islands"));
  const used = new Set([later.cardId, earlier.cardId]);
  state.expansion!.eventDeck = state.expansion!.eventDeck.filter((c) => !used.has(c.cardId));
  const [m0, m3, m4] = state.market.filter((c) => !isEventCard(c));
  state.market = [m0!, later, earlier, m3!, m4!];
  state.expansion!.rowBreak = null;
  state.election.active = true;
  state.election.needsOpening = true;
  openElectionIfNeeded(state, []);
  const [row1, row2] = marketRows(state);
  assert(row1!.length === 5 && row2!.length === 5, "Two full rows of 5");
  assert(row1![0] === m0 && row1![2] === earlier && row1![3] === m3 && row1![4] === m4, "Row 1: nothing moved, the earlier event stays in spot 3");
  assert(!isEventCard(row1![1]!), "Row 1: the gap in spot 2 filled from the main deck");
  assert(row2![1] === later, "Row 2: the later event dropped into spot 2");
  assert(row2!.filter(isEventCard).length === 1, "Row 2: every other spot is a main card");
}
{
  let replay = start(12);
  let opened = false;
  let ended = false;
  let resets = 0;
  for (let i = 0; i < 400 && !replay.state.victory; i++) {
    const before = replay.state.election.active;
    replay = randomStep(replay, i);
    const s = replay.state;
    if (!before && s.election.active && !s.election.needsOpening && s.expansion!.rowBreak !== null && !opened) {
      opened = true;
      const rows = marketRows(s);
      assert(rows.length === 2, "Election: two Market rows");
      assert(rows.flat().filter((c) => !isEventCard(c)).length <= 8, "Election: up to 8 main cards");
      for (const row of rows) assert(row.filter(isEventCard).length <= 1, "At most one event per row");
    }
    if (before && !s.election.active) ended = true;
    // Rows reset once the winner has activated decrees and the next turn starts.
    if (ended && s.phase === Phase.Action && !s.election.active) {
      ended = false;
      resets += 1;
      assert(s.expansion!.rowBreak === null, "Rows end with the election");
      assert(s.market.length <= 5, "Back to one row of 5");
      assert(s.market.filter(isEventCard).length <= 2, "1–2 events after the reset");
    }
  }
  assert(opened, "An election opened during the autoplay");
  assert(resets > 0 || replay.state.victory, "An election finished during the autoplay");
}

// --- Full games: replay determinism and engine invariants ----------------------------------------
for (const seed of [21, 22, 23, 24, 25]) {
  let replay = start(seed, seed % 2 === 0);
  for (let i = 0; i < 600 && !replay.state.victory; i++) replay = randomStep(replay, i);
  const sim = simulate(toRecord(replay));
  assert(sim.failure === null, `Seed ${seed}: replay failed: ${sim.failure?.message}`);
  assert(sim.issues.length === 0, `Seed ${seed}: invariants: ${JSON.stringify(sim.issues[0])}`);
  const rebuilt = replayRecord(toRecord(replay));
  assert(JSON.stringify(rebuilt.state) === JSON.stringify(replay.state), `Seed ${seed}: deterministic replay`);
  const bought = replay.steps.filter((step) => step.action.type === "buyEvent").length;
  assert(bought > 0, `Seed ${seed}: the autoplay bought at least one event`);
}

function plainTurn(replay: Replay): Replay {
  const me = replay.state.activePlayer;
  let next = replay;
  for (let guard = 0; guard < 20 && next.state.activePlayer === me && !next.state.victory; guard++) {
    const options = legalActions(next.state, currentActor(next.state));
    const pick =
      options.find((a) => a.type === "playCivil") ??
      options.find((a) => a.type === "endAction") ??
      options.find((a) => a.type === "endPolitics") ??
      options.find((a) => a.type === "takeMarket") ??
      options[0]!;
    next = stepReplay(next, pick);
  }
  return next;
}

function randomStep(replay: Replay, i: number): Replay {
  const options = legalActions(replay.state, currentActor(replay.state));
  const buys = options.filter((a) => a.type === "buyEvent");
  if (buys.length > 0 && chooser.nextInt(2) === 0) return stepReplay(replay, buys[chooser.nextInt(buys.length)]!);
  const busy = options.filter((a) => a.type !== "endAction" && a.type !== "endPolitics");
  const pool = busy.length > 0 && chooser.nextInt(4) > 0 ? busy : options;
  void i;
  return stepReplay(replay, pool[chooser.nextInt(pool.length)]!);
}

report("Expansion ok: setup, victories, West/South/North/East effects, Market events and costs, buying (effect, civil, legacy), election rows, full games.");
