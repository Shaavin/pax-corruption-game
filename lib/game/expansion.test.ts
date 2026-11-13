/** Legacy & Diplomacy: setup, the event Market, buying, every event effect, victories, election rows. */
import { getCard } from "../cards/catalog.ts";
import { EVENTS, getEvent, WORLD_POWERS, type EventCard } from "../cards/expansion.ts";
import { CardKind, DecreeId, District, MonumentId, PolicyId, type DistrictId } from "../cards/schema.ts";
import { simulate } from "./diagnostics.ts";
import { eventCost, marketRows, snapshotMarket } from "./draw.ts";
import { apply, currentActor, legalActions } from "./engine.ts";
import { buyEventActions } from "./events.ts";
import { freeActions } from "./free-actions.ts";
import { playerDistrictInfluence } from "./influence.ts";
import { canRecruitIn } from "./main.ts";
import { newReplay, replayRecord, stepReplay, toRecord, type Replay } from "./record.ts";
import { convincedSenators } from "./senate.ts";
import { activeDecrees, inactiveDecrees } from "./decrees.ts";
import { createSeededRng } from "./rng.ts";
import { Phase, VictoryKind, type CardInstance, type GameState, type PlayerId } from "./types.ts";
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
  assert(fi.eventDeck.length === 25, "Foreign Influence: 25 left in the event deck");
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

  // South: Senate convinced, conspiracies included.
  state.expansion!.commonArea = [];
  const district = getCard(state.senate[0]!.cardId) as { district: DistrictId };
  assert(!convincedSenators(state, []).includes(0), "Nothing convinced without a reveal");
  const south = EVENTS.find((e) => !e.legacy && e.effect.type === "senateConvinced" && e.effect.district === district.district)!;
  inEffect(state, south.name);
  assert(convincedSenators(state, []).includes(0), "South: that district's Senators are always convinced");

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
}

// --- Election rows ------------------------------------------------------------------------------
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
