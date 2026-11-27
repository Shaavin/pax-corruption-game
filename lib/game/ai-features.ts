/**
 * A position as numbers, from one seat's point of view, for the computer's learned evaluator
 * (ai-net.ts; trained by training/train.py on games from scripts/ai-selfplay.ts, encoded by
 * scripts/ai-encode.ts).
 *
 * Only what that seat may know: its own hand and network, everything on the table, and the
 * opponent's hand only by its size and the cards they took face up from the Market. The deck,
 * the monument deck, and the opponent's face-down cards are one unseen place.
 *
 * Civil cards are only a district and a number, so they're counted: per district and place, how
 * many, their total, and the highest (in hand, on each tableau, in the Senate, in the Market,
 * seen in their hand, and still unseen). Alliances and conspiracies are named (their abilities
 * and districts matter): on or off per card and place. That generalizes from far fewer games
 * than naming every card.
 *
 * Sparse features are on or off (an alliance in a place, a policy side, a phase); dense ones are
 * counts and margins, scaled to about −1…1. `FEATURE_VERSION` names the layout: weights trained
 * on another layout are refused. Change the version whenever the layout changes.
 *
 * Timing: which deck mode, and how many cards until the next General Election and the final
 * one can be expected (from the mode's piles, the cards drawn, and the elections already out).
 *
 * Legacy & Diplomacy (all zero in a base game): each event's place (in the Market, or in effect
 * for this seat, the opponent, or everyone), which switchable victories are active, relations
 * with each World Power, the cheapest event's cost, and Cultural and Diplomatic progress. An
 * event played as a civil card counts with the civils on its tableau (not with the main deck's).
 *
 * A victory's condition counts as met only while that victory is active: in Legacy & Diplomacy
 * most start inactive, and meeting an inactive one wins nothing until a legacy event activates
 * it, so "met but inactive" is a feature of its own.
 *
 * Ideological outlook: Ideological Victory is the slow road (4 copies of a symbol, more than any
 * other), and what matters is which copies are still to be had. Per symbol: its policies one
 * proposal away (the district is neutral) or two (the other side is in effect: a policy goes
 * through neutral), whether its decree is still inactive, its monuments not yet built (face up,
 * or still in the monument deck), the private-copy lead, and the copies still to go. Per seat:
 * whether the copies its best symbol still needs are still to be had, and whether it is one
 * move away.
 *
 * Proposal readiness: how close a seat's cards come to passing a proposal now (the share of the
 * Senate's votes its best reveal convinces, whether that passes, and which districts it opens).
 * Passing the last policy was what a player one copy from Ideological Victory seldom could do.
 * The opponent's is counted from what can be seen of their cards: those they took face up, and
 * their network.
 *
 * Fund a monument (`pax-features-7`, 2026-11-26): the cards tucked under each monument while it's
 * up for building (each lowers its cost of 5 by 1, for either player), the cheapest one's cost,
 * and how many cards each seat is short of a monument it could build (the opponent's counted
 * from what can be seen).
 */
import { getCard, MAIN_DECK, MONUMENTS, PARTIES, POLICIES } from "../cards/catalog.ts";
import { EVENTS, ExpansionVictory, isEventId, WORLD_POWERS } from "../cards/expansion.ts";
import { CardKind, DecreeId, DISTRICTS, SYMBOLS, type DistrictId, type SymbolId } from "../cards/schema.ts";
import { activeDecrees, decreeSymbol, meetsDecree, passesDeJuresIn } from "./decrees.ts";
import { isFinalElection, lordsSymbols, tallyElection } from "./election.ts";
import { currentActor } from "./engine.ts";
import { playerDistrictInfluence } from "./influence.ts";
import { victoryRace } from "./progress.ts";
import { Phase, type CardInstance, type GameState, type PlayerId } from "./types.ts";
import { DRAW_PLANS } from "./setup.ts";
import { CONSTRUCT_COST, handLikeCards, printedDistrict } from "./main.ts";
import { fundedCards, monumentCost } from "./monuments.ts";
import { bestReveal, convincedVotes, proposalDistricts, senateVotesNeeded } from "./senate.ts";
import { IDEOLOGICAL_COUNT, privateSymbols, totalSymbols } from "./victory.ts";
import { iconsDisabled, militaryLeadBonus, relationLeads, supportCount, victoryActive } from "./world.ts";
import { otherPlayer } from "./zones.ts";

export const FEATURE_VERSION = "pax-features-7";

/** Victories Legacy & Diplomacy can leave inactive. */
const SWITCHABLE = ["military", "popularity", "ideological", "cultural", "diplomatic"];

/** Where an alliance or conspiracy can be seen (otherwise it's unseen or in a support pile). */
const NAMED_PLACES = ["myHand", "myTableau", "theirTableau", "senate", "market", "theirHandSeen", "theirNetwork"] as const;
/** Where civil cards are counted. */
const CIVIL_PLACES = ["myHand", "myTableau", "theirTableau", "senate", "market", "theirHandSeen"] as const;
type Place = (typeof NAMED_PLACES)[number];

const NAMED_CARDS = MAIN_DECK.filter((card) => card.kind === CardKind.Alliance || card.kind === CardKind.Conspiracy).map((card) => card.id);
const DECREES = Object.values(DecreeId);
const PHASES = [Phase.Setup, Phase.Action, Phase.Politics, Phase.Income, Phase.DecreeChoice] as const;
const SENATE_KINDS = [CardKind.Civil, CardKind.Alliance, CardKind.Conspiracy] as const;

/** Civil cards in each district (count and total), for what's still unseen. */
const CIVIL_TOTALS = new Map<DistrictId, { count: number; sum: number }>(DISTRICTS.map((district) => [district, { count: 0, sum: 0 }]));
for (const card of MAIN_DECK) {
  if (card.kind !== CardKind.Civil) continue;
  const total = CIVIL_TOTALS.get(card.district)!;
  total.count++;
  total.sum += card.influence;
}

/** The sparse layout: each feature's index, built once from the catalog. */
const SPARSE = (() => {
  const names: string[] = [];
  const add = (name: string) => names.push(name);
  for (const card of NAMED_CARDS) for (const place of NAMED_PLACES) add(`card:${card}:${place}`);
  for (let slot = 0; slot < 5; slot++) {
    for (const district of DISTRICTS) add(`senate:${slot}:district:${district}`);
    for (const kind of SENATE_KINDS) add(`senate:${slot}:kind:${kind}`);
  }
  for (const monument of MONUMENTS) for (const where of ["available", "mine", "theirs"]) add(`monument:${monument.id}:${where}`);
  for (const party of PARTIES) for (const whose of ["mine", "theirs"]) add(`party:${party.id}:${whose}`);
  for (const district of DISTRICTS) for (const side of ["neutral", "a", "b"]) add(`policy:${district}:${side}`);
  for (const decree of DECREES) for (const fact of ["active", "iMeet", "theyMeet"]) add(`decree:${decree}:${fact}`);
  for (const phase of PHASES) for (const mover of ["me", "them"]) add(`phase:${phase}:${mover}`);
  for (const flag of ["mainActionDone", "constructedMonument", "electionActive", "electionOpening", "severalElections", "finalElection", "lastWinnerMe", "lastWinnerThem", "firstPlayerMe"]) add(`flag:${flag}`);
  for (let out = 0; out <= 4; out++) add(`electionsOut:${out}`);
  for (const mode of Object.keys(DRAW_PLANS)) add(`mode:${mode}`);
  add("expansion");
  for (const victory of Object.values(ExpansionVictory)) add(`victoryActive:${victory}`);
  for (const event of EVENTS) for (const where of ["market", "mine", "theirs", "everyone"]) add(`event:${event.id}:${where}`);
  return { names, index: new Map(names.map((name, index) => [name, index])) };
})();

/** The dense layout, in order. */
const DENSE_NAMES = (() => {
  const names = ["partisansMine", "partisansTheirs", "partisansLead"];
  for (const district of DISTRICTS) {
    for (const fact of ["supportMine", "supportTheirs", "supportLead", "influenceMine", "influenceTheirs", "influenceMargin", "civilsMine", "civilsTheirs", "deJuresMine", "deJuresTheirs"]) {
      names.push(`${district}:${fact}`);
    }
  }
  names.push("electoratesMine", "electoratesTheirs", "electorsMine", "electorsTheirs", "lordsMine", "lordsTheirs", "winsMine", "winsTheirs");
  names.push("handMine", "handTheirs", "handLimitMine", "networkMine", "networkTheirs", "market", "deck");
  for (const kind of ["political", "military", "popularity", "ideological"]) {
    names.push(`${kind}:mine`, `${kind}:theirs`, `${kind}:metMine`, `${kind}:metTheirs`);
  }
  for (const symbol of SYMBOLS) names.push(`symbol:${symbol}:total`, `symbol:${symbol}:mine`, `symbol:${symbol}:theirs`);
  names.push("supportTotalMine", "supportTotalTheirs", "supportTotalLead", "bestInfluenceLead");
  for (const district of DISTRICTS) {
    for (const place of CIVIL_PLACES) names.push(`civils:${district}:${place}:count`, `civils:${district}:${place}:sum`, `civils:${district}:${place}:top`);
    names.push(`civils:${district}:unseen:count`, `civils:${district}:unseen:sum`, `hand:${district}:cards`);
  }
  for (let slot = 0; slot < 5; slot++) names.push(`senate:${slot}:value`);
  for (const power of WORLD_POWERS) names.push(`relation:${power}:mine`, `relation:${power}:theirs`);
  names.push("relationLeadsMine", "relationLeadsTheirs", "eventDeck", "marketEvents", "cheapestEvent", "militaryLeadBonus");
  for (const kind of ["cultural", "diplomatic"]) names.push(`${kind}:mine`, `${kind}:theirs`, `${kind}:metMine`, `${kind}:metTheirs`);
  names.push("electionsLeft", "cardsToNextElection", "cardsToFinalElection");
  for (const kind of SWITCHABLE) names.push(`${kind}:metInactiveMine`, `${kind}:metInactiveTheirs`);
  for (const symbol of SYMBOLS) {
    for (const fact of ["policyNeutral", "policyAcross", "decreeOpen", "monumentsUp", "monumentsDeck", "privateLead", "toGo"]) names.push(`ideology:${symbol}:${fact}`);
  }
  names.push("ideology:roadOpenMine", "ideology:oneMoveMine", "ideology:roadOpenTheirs", "ideology:oneMoveTheirs");
  for (const whose of ["Mine", "TheirsSeen"]) {
    names.push(`propose:votes${whose}`, `propose:passes${whose}`);
    for (const district of DISTRICTS) names.push(`propose:${district}:opens${whose}`);
  }
  for (const monument of MONUMENTS) names.push(`monument:${monument.id}:funded`);
  names.push("monument:cheapestCost", "monument:shortMine", "monument:shortTheirsSeen");
  return names;
})();

/** Each named card's feature index per place (the hot path skips building names). */
const NAMED_INDEX = new Map(NAMED_CARDS.map((card) => [card, new Map<Place, number>(NAMED_PLACES.map((place) => [place, SPARSE.index.get(`card:${card}:${place}`)!]))]));
const CIVIL_OFFSET = new Map<Place, number>(CIVIL_PLACES.map((place, at) => [place, at]));

export const SPARSE_COUNT = SPARSE.names.length;
export const DENSE_COUNT = DENSE_NAMES.length;
export const SPARSE_NAMES: readonly string[] = SPARSE.names;
export { DENSE_NAMES };

export type Features = {
  /** Indices of the sparse features that are on, ascending. */
  sparse: number[];
  /** `DENSE_COUNT` values. */
  dense: Float32Array;
};

/** Civil cards counted while placing cards: per district and place [count, sum, top], and everything visible. */
type CardCounts = {
  civils: Map<DistrictId, number[][]>;
  visible: Map<DistrictId, { count: number; sum: number }>;
  /** Cards of each district in its hand and network (sets for recruits and monuments). */
  hand: Map<DistrictId, number>;
};

/** The position as `seat` sees it. */
export function encodeState(state: GameState, seat: PlayerId): Features {
  const them = otherPlayer(seat);
  const me = state.players[seat];
  const opponent = state.players[them];
  const on: number[] = [];
  const set = (name: string) => {
    const index = SPARSE.index.get(name);
    if (index !== undefined) on.push(index);
  };

  const counts: CardCounts = {
    civils: new Map(DISTRICTS.map((district) => [district, CIVIL_PLACES.map(() => [0, 0, 0])])),
    visible: new Map(DISTRICTS.map((district) => [district, { count: 0, sum: 0 }])),
    hand: new Map(DISTRICTS.map((district) => [district, 0])),
  };
  // Named cards switch on their place; civil cards are counted. `where` null: visible but not a
  // counted place (support piles, which the dense features count anyway).
  const put = (cards: readonly CardInstance[], where: Place | null) => {
    for (const card of cards) {
      if (isEventId(card.cardId)) {
        if (where === "market") set(`event:${card.cardId}:market`);
        else if (where === "myTableau" || where === "theirTableau") {
          const def = getCard(card.cardId);
          if (def.kind === CardKind.Civil) {
            const stats = counts.civils.get(def.district)![CIVIL_OFFSET.get(where)!]!;
            stats[0]! += 1;
            stats[1]! += def.influence;
            stats[2] = Math.max(stats[2]!, def.influence);
          }
        }
        continue;
      }
      const def = getCard(card.cardId);
      if (def.kind === CardKind.Civil) {
        const visible = counts.visible.get(def.district)!;
        visible.count++;
        visible.sum += def.influence;
        const at = where === null ? undefined : CIVIL_OFFSET.get(where);
        if (at === undefined) continue;
        const stats = counts.civils.get(def.district)![at]!;
        stats[0]! += 1;
        stats[1]! += def.influence;
        stats[2] = Math.max(stats[2]!, def.influence);
      } else if (where !== null) {
        const index = NAMED_INDEX.get(card.cardId)?.get(where);
        if (index !== undefined) on.push(index);
      }
    }
  };
  // Its hand and network are both usable as a hand.
  for (const card of [...me.hand, ...me.network]) {
    const def = getCard(card.cardId);
    if ("district" in def) counts.hand.set(def.district, counts.hand.get(def.district)! + 1);
  }
  put(me.hand, "myHand");
  put(me.network, "myHand");
  put(opponent.network, "theirNetwork");
  put(opponent.hand.filter((card) => card.faceUp), "theirHandSeen");
  for (const district of DISTRICTS) {
    put(me.tableau[district], "myTableau");
    put(opponent.tableau[district], "theirTableau");
    put(me.support[district], null);
    put(opponent.support[district], null);
  }
  put(state.senate, "senate");
  put(state.market, "market");

  state.senate.forEach((card, slot) => {
    const def = getCard(card.cardId);
    if ("district" in def) set(`senate:${slot}:district:${def.district}`);
    set(`senate:${slot}:kind:${def.kind}`);
  });
  for (const monument of state.availableMonuments) set(`monument:${monument.cardId}:available`);
  for (const monument of me.monuments) set(`monument:${monument.cardId}:mine`);
  for (const monument of opponent.monuments) set(`monument:${monument.cardId}:theirs`);
  if (me.partyId) set(`party:${me.partyId}:mine`);
  if (opponent.partyId) set(`party:${opponent.partyId}:theirs`);
  for (const district of DISTRICTS) {
    const policy = state.policy[district];
    set(`policy:${district}:${policy ? policy.slice(policy.lastIndexOf("-") + 1) : "neutral"}`);
  }
  const playing = state.phase !== Phase.Setup && state.phase !== Phase.GameOver;
  for (const decree of state.decrees) {
    if (decree.active) set(`decree:${decree.id}:active`);
    if (playing && meetsDecree(state, seat, decree.id)) set(`decree:${decree.id}:iMeet`);
    if (playing && meetsDecree(state, them, decree.id)) set(`decree:${decree.id}:theyMeet`);
  }
  if (state.phase !== Phase.GameOver) set(`phase:${state.phase}:${currentActor(state) === seat ? "me" : "them"}`);
  if (state.turn.mainActionDone) set("flag:mainActionDone");
  if (state.turn.constructedMonument) set("flag:constructedMonument");
  if (state.election.active) set("flag:electionActive");
  if (state.election.needsOpening) set("flag:electionOpening");
  if (state.election.generalElections > 1) set("flag:severalElections");
  if (state.election.active && isFinalElection(state)) set("flag:finalElection");
  if (state.election.lastWinner === seat) set("flag:lastWinnerMe");
  if (state.election.lastWinner === them) set("flag:lastWinnerThem");
  if (state.firstPlayer === seat) set("flag:firstPlayerMe");
  set(`electionsOut:${Math.min(4, state.electionsOut.length)}`);
  set(`mode:${state.mode}`);
  if (state.expansion) {
    set("expansion");
    for (const victory of Object.values(ExpansionVictory)) if (victoryActive(state, victory)) set(`victoryActive:${victory}`);
    for (const played of state.expansion.commonArea) {
      set(`event:${played.card.cardId}:${played.owner === null ? "everyone" : played.owner === seat ? "mine" : "theirs"}`);
    }
  }

  const dense = new Float32Array(DENSE_COUNT);
  if (playing) fillDense(state, seat, dense, counts);
  return { sparse: on.sort((a, b) => a - b), dense };
}

function fillDense(state: GameState, seat: PlayerId, dense: Float32Array, counts: CardCounts): void {
  const them = otherPlayer(seat);
  const me = state.players[seat];
  const opponent = state.players[them];
  let at = 0;
  const push = (value: number) => {
    dense[at++] = Number.isFinite(value) ? value : 0;
  };
  const clip = (value: number) => Math.max(-1, Math.min(1, value));

  push(me.partisans / 5);
  push(opponent.partisans / 5);
  push(clip((me.partisans - opponent.partisans) / 3));
  let supportMine = 0;
  let supportTheirs = 0;
  let bestLead = -Infinity;
  for (const district of DISTRICTS) {
    const mySupport = supportCount(state, seat, district);
    const theirSupport = supportCount(state, them, district);
    supportMine += mySupport;
    supportTheirs += theirSupport;
    const myInfluence = playerDistrictInfluence(state, seat, district).total;
    const theirInfluence = playerDistrictInfluence(state, them, district).total;
    bestLead = Math.max(bestLead, myInfluence - theirInfluence);
    push(mySupport / 10);
    push(theirSupport / 10);
    push(clip((mySupport - theirSupport) / 9));
    push(myInfluence / 30);
    push(theirInfluence / 30);
    push(Math.tanh((myInfluence - theirInfluence) / 5));
    push(civils(state, seat, district) / 5);
    push(civils(state, them, district) / 5);
    push(passesDeJuresIn(state, seat, district) ? 1 : 0);
    push(passesDeJuresIn(state, them, district) ? 1 : 0);
  }
  const tally = tallyElection(state);
  push(tally.electorates[seat] / 5);
  push(tally.electorates[them] / 5);
  push(tally.electors[seat] / 10);
  push(tally.electors[them] / 10);
  push(lordsSymbols(state, seat) / 4);
  push(lordsSymbols(state, them) / 4);
  push(me.electionWins / 3);
  push(opponent.electionWins / 3);
  push(me.hand.length / 7);
  push(opponent.hand.length / 7);
  push(me.handLimit / 7);
  push(me.network.length / 5);
  push(opponent.network.length / 5);
  push(state.market.length / 8);
  push(state.deck.length / 90);
  const race = victoryRace(state);
  for (const kind of ["political", "military", "popularity", "ideological"]) {
    const row = race.rows.find((entry) => entry.kind === kind);
    const mine = row?.standing[seat];
    const theirs = row?.standing[them];
    push(mine ? clip(mine.value / mine.target) : 0);
    push(theirs ? clip(theirs.value / theirs.target) : 0);
    push(mine?.met && row!.active ? 1 : 0);
    push(theirs?.met && row!.active ? 1 : 0);
  }
  const totals = totalSymbols(state);
  const mine = privateSymbols(state, seat);
  const theirs = privateSymbols(state, them);
  for (const symbol of SYMBOLS) {
    push(totals[symbol] / 6);
    push(mine[symbol] / 3);
    push(theirs[symbol] / 3);
  }
  push(supportMine / 30);
  push(supportTheirs / 30);
  push(clip((supportMine - supportTheirs) / 10));
  push(clip(bestLead / 20));
  for (const district of DISTRICTS) {
    for (const [count, sum, top] of counts.civils.get(district)!) {
      push(count! / 5);
      push(sum! / 30);
      push(top! / 9);
    }
    const total = CIVIL_TOTALS.get(district)!;
    const visible = counts.visible.get(district)!;
    push((total.count - visible.count) / 18);
    push((total.sum - visible.sum) / total.sum);
    push(counts.hand.get(district)! / 5);
  }
  for (let slot = 0; slot < 5; slot++) {
    const card = state.senate[slot];
    const def = card ? getCard(card.cardId) : null;
    push(def && def.kind === CardKind.Civil ? def.influence / 9 : 0);
  }
  const expansion = state.expansion;
  for (const power of WORLD_POWERS) {
    push(expansion ? expansion.relations[seat][power] / 6 : 0);
    push(expansion ? expansion.relations[them][power] / 6 : 0);
  }
  push(expansion ? relationLeads(state, seat) / 3 : 0);
  push(expansion ? relationLeads(state, them) / 3 : 0);
  push(expansion ? expansion.eventDeck.length / 28 : 0);
  const costs = expansion ? state.market.filter((card) => isEventId(card.cardId)).map((card) => expansion.eventCosts[card.instanceId] ?? 0) : [];
  push(costs.length / 2);
  push(costs.length ? Math.min(...costs) / 5 : 0);
  push(expansion ? militaryLeadBonus(state) / 3 : 0);
  for (const kind of ["cultural", "diplomatic"]) {
    const row = race.rows.find((entry) => entry.kind === kind);
    const mineRow = row?.standing[seat];
    const theirsRow = row?.standing[them];
    push(mineRow ? clip(mineRow.value / mineRow.target) : 0);
    push(theirsRow ? clip(theirsRow.value / theirsRow.target) : 0);
    push(mineRow?.met && row!.active ? 1 : 0);
    push(theirsRow?.met && row!.active ? 1 : 0);
  }
  const timing = electionTiming(state);
  push(timing.left / 4);
  push(timing.next / 30);
  push(timing.last / 60);
  for (const kind of SWITCHABLE) {
    const row = race.rows.find((entry) => entry.kind === kind);
    push(row && !row.active && row.standing[seat].met ? 1 : 0);
    push(row && !row.active && row.standing[them].met ? 1 : 0);
  }
  const outlook = ideologyOutlook(state, totals);
  for (const symbol of SYMBOLS) {
    const road = outlook.get(symbol)!;
    push(road.policyNeutral / 2);
    push(road.policyAcross / 2);
    push(road.decreeOpen ? 1 : 0);
    push(road.monumentsUp / 2);
    push(road.monumentsDeck / 2);
    push(clip((mine[symbol] - theirs[symbol]) / 2));
    push(road.toGo / 4);
  }
  for (const [own, other] of [[mine, theirs], [theirs, mine]] as const) {
    let open = false;
    let oneMove = false;
    for (const symbol of SYMBOLS) {
      if (own[symbol] <= other[symbol]) continue;
      const road = outlook.get(symbol)!;
      // Copies a proposal or an election can still add (a monument takes five cards of a district).
      const shared = road.policyNeutral + road.policyAcross + (road.decreeOpen ? 1 : 0);
      if (road.toGo <= shared + road.monumentsUp + road.monumentsDeck) open = true;
      if (road.toGo === 1 && (road.policyNeutral > 0 || road.decreeOpen || road.monumentsUp > 0)) oneMove = true;
    }
    push(open ? 1 : 0);
    push(oneMove ? 1 : 0);
  }
  for (const cards of [handLikeCards(state, seat, { market: false }), [...opponent.hand.filter((card) => card.faceUp), ...opponent.network]]) {
    const reveal = state.phase === "setup" ? [] : bestReveal(state, cards).map((card) => card.cardId);
    const share = reveal.length ? Math.min(1, convincedVotes(state, reveal) / senateVotesNeeded(state)) : 0;
    const opens = reveal.length ? proposalDistricts(state, reveal) : new Set<DistrictId>();
    push(share);
    push(share >= 1 ? 1 : 0);
    for (const district of DISTRICTS) push(opens.has(district) ? 1 : 0);
  }
  // Fund a monument: what's tucked under each, the cheapest cost, and how short each seat is.
  for (const monument of MONUMENTS) {
    const up = state.availableMonuments.find((entry) => entry.cardId === monument.id);
    push(up ? fundedCards(state, up.instanceId).length / 4 : 0);
  }
  const theirsSeen = [...opponent.hand.filter((card) => card.faceUp), ...opponent.network];
  const ownCards = handLikeCards(state, seat, { market: true });
  let cheapest = CONSTRUCT_COST;
  let shortMine = CONSTRUCT_COST;
  let shortTheirs = CONSTRUCT_COST;
  for (const monument of state.availableMonuments) {
    const cost = monumentCost(state, monument.instanceId);
    const district = printedDistrict(monument.cardId);
    const of = (cards: CardInstance[]) =>
      cards.filter((card) => {
        const def = getCard(card.cardId);
        return "district" in def && def.district === district;
      }).length;
    cheapest = Math.min(cheapest, cost);
    shortMine = Math.min(shortMine, Math.max(0, cost - of(ownCards)));
    shortTheirs = Math.min(shortTheirs, Math.max(0, cost - of(theirsSeen)));
  }
  push(cheapest / CONSTRUCT_COST);
  push(shortMine / CONSTRUCT_COST);
  push(shortTheirs / CONSTRUCT_COST);
  if (at !== DENSE_COUNT) throw new Error(`Encoded ${at} dense features, expected ${DENSE_COUNT}`);
}

/** Per symbol, the Ideological copies still to be had (see the file comment). */
type SymbolRoad = { policyNeutral: number; policyAcross: number; decreeOpen: boolean; monumentsUp: number; monumentsDeck: number; toGo: number };

const DECREE_OF = new Map<SymbolId, string>(Object.values(DecreeId).map((decree) => [decreeSymbol(decree), decree]));
const MONUMENT_SYMBOLS = new Map<string, readonly SymbolId[]>(MONUMENTS.map((monument) => [monument.id, monument.symbols]));

function ideologyOutlook(state: GameState, totals: Record<SymbolId, number>): Map<SymbolId, SymbolRoad> {
  const active = new Set<string>(activeDecrees(state));
  const roads = new Map<SymbolId, SymbolRoad>();
  for (const symbol of SYMBOLS) {
    let policyNeutral = 0;
    let policyAcross = 0;
    for (const policy of POLICIES) {
      if (policy.symbol !== symbol || iconsDisabled(state, policy.district)) continue;
      const now = state.policy[policy.district];
      if (now === null) policyNeutral++;
      else if (now !== policy.id) policyAcross++;
    }
    const carries = (cardId: string) => MONUMENT_SYMBOLS.get(cardId)?.includes(symbol) ?? false;
    const others = Math.max(...SYMBOLS.filter((other) => other !== symbol).map((other) => totals[other]));
    roads.set(symbol, {
      policyNeutral,
      policyAcross,
      decreeOpen: !active.has(DECREE_OF.get(symbol)!),
      monumentsUp: state.availableMonuments.filter((monument) => carries(monument.cardId)).length,
      monumentsDeck: state.monumentDeck.filter((monument) => carries(monument.cardId)).length,
      toGo: Math.max(0, Math.max(IDEOLOGICAL_COUNT, others + 1) - totals[symbol]),
    });
  }
  return roads;
}

/**
 * How many cards until the next General Election and the final one can be expected, and how
 * many are left: the mode's piles in order, each pile's elections shuffled in (spread evenly
 * over its undrawn cards) or at its bottom, less the cards drawn and the elections already out
 * (which come out in deck order, so from the first piles).
 */
function electionTiming(state: GameState): { left: number; next: number; last: number } {
  const plan = DRAW_PLANS[state.mode];
  const total = plan.reduce((sum, pile) => sum + pile.cards + pile.elections, 0);
  const drawn = total - state.deck.length;
  let out = state.electionsOut.length;
  let start = 0;
  const ahead: number[] = [];
  for (const pile of plan) {
    const end = start + pile.cards + pile.elections;
    const gone = Math.min(pile.elections, out);
    out -= gone;
    const left = pile.elections - gone;
    if (left > 0) {
      const from = Math.max(start, drawn);
      const span = Math.max(1, end - from);
      for (let n = 1; n <= left; n++) ahead.push(from - drawn + (pile.placement === "bottom" ? span : (span * n) / (left + 1)));
    }
    start = end;
  }
  return { left: ahead.length, next: ahead[0] ?? 0, last: ahead.at(-1) ?? 0 };
}

function civils(state: GameState, player: PlayerId, district: DistrictId): number {
  return state.players[player].tableau[district].filter((card) => getCard(card.cardId).kind === CardKind.Civil).length;
}
