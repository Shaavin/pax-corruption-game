/**
 * What the computer is playing for (lib/game/ai.ts). An agenda makes some parts of the board
 * count for more, so games against it don't all look alike: one game it rallies partisans,
 * another it hoards a district's cards for a monument, another it fights for every electorate.
 *
 * Each game it leans toward an agenda of its own (its temperament: from the deal and its
 * party), and it switches when the board makes another more promising or its own hopeless.
 */
import { getCard, getParty, MONUMENTS, POLICIES } from "../cards/catalog.ts";
import { DecreeId, MonumentId, SYMBOLS, type DistrictId, type SymbolId } from "../cards/schema.ts";
import type { Weights } from "./ai-score.ts";
import { activeDecrees, decreeSymbol, meetsDecree, satisfiedDecrees } from "./decrees.ts";
import { GENERAL_ELECTION_COUNT, tallyElection } from "./election.ts";
import { canRecruitIn, handLikeCards } from "./main.ts";
import { fundedCards } from "./monuments.ts";
import { victoryRace } from "./progress.ts";
import { VictoryKind, type GameState, type PlayerId, type VictoryKindId } from "./types.ts";
import { IDEOLOGICAL_COUNT, privateSymbols, totalSymbols } from "./victory.ts";
import { bestReveal, convincedVotes, proposalDistricts, senateVotesNeeded } from "./senate.ts";
import { iconsDisabled, relationLeads, supportCount, victoryActive } from "./world.ts";
import { otherPlayer } from "./zones.ts";

export const Agenda = {
  /** Win the final election (Civil): electorates, the Lords, elections won. */
  Elections: "elections",
  /** Win elections to activate decrees, then meet two (Political). */
  Decrees: "decrees",
  /** Recruit partisans (Military). */
  Military: "military",
  /** Pile support into one district (Popularity). */
  Popularity: "popularity",
  /** Make its symbol the dominant one (Ideological). */
  Ideology: "ideology",
  /** Hoard one district's cards and build monuments (Cultural, symbols, abilities). */
  Monuments: "monuments",
  /** Buy events for relations with the World Powers (Diplomatic, expansion). */
  Diplomacy: "diplomacy",
} as const;
export type AgendaId = (typeof Agenda)[keyof typeof Agenda];

const ALL: readonly AgendaId[] = Object.values(Agenda);

/** The victory each agenda plays for (null: several, or none in particular). */
const VICTORY_OF: Record<AgendaId, VictoryKindId | null> = {
  elections: VictoryKind.Civil,
  decrees: VictoryKind.Political,
  military: VictoryKind.Military,
  popularity: VictoryKind.Popularity,
  ideology: VictoryKind.Ideological,
  monuments: null,
  diplomacy: VictoryKind.Diplomatic,
};

/**
 * The agenda `seat` plays for now. `temperament` (0 → 1) is how much its own leaning counts
 * against what the board offers; it fades as the game goes on. The agenda it already follows
 * (`incumbent`) keeps the lead unless another is better by more than `stick`.
 */
export function chooseAgenda(state: GameState, seat: PlayerId, temperament: number, incumbent: AgendaId | null = null, stick = 0): AgendaId {
  const elapsed = Math.min(1, state.electionsOut.length / GENERAL_ELECTION_COUNT);
  const lean = temperament * (1 - 0.5 * elapsed);
  let best: AgendaId = Agenda.Elections;
  let top = -Infinity;
  for (const agenda of ALL) {
    const victory = VICTORY_OF[agenda];
    if (victory && !victoryActive(state, victory)) continue;
    const value = lean * leaning(state, seat, agenda) + (1 - lean) * prospect(state, seat, agenda) + (agenda === incumbent ? stick : 0);
    if (value > top) [top, best] = [value, agenda];
  }
  return best;
}

/**
 * The weights for an agenda: its parts of the board count for more. `strength` (0 → 1) is
 * how hard it leans.
 */
export function focusWeights(base: Weights, agenda: AgendaId, strength: number): Weights {
  const w: Weights = { ...base, victory: { ...base.victory } };
  const more = (value: number, by: number) => value * (1 + (by - 1) * strength);
  switch (agenda) {
    case Agenda.Elections:
      w.electorates = more(w.electorates, 1.6);
      w.district = more(w.district, 1.4);
      w.electionWins = more(w.electionWins, 1.6);
      w.lords = more(w.lords, 2.5);
      break;
    case Agenda.Decrees:
      w.victory.political = more(w.victory.political, 1.9);
      w.electionWins = more(w.electionWins, 1.6);
      w.decreeReady = 12 * strength;
      break;
    case Agenda.Military:
      w.victory.military = more(w.victory.military, 1.9);
      w.handRecruit = more(w.handRecruit, 2.2);
      w.recruitPlan = 4 * strength;
      break;
    case Agenda.Popularity:
      w.victory.popularity = more(w.victory.popularity, 2);
      w.handRecruit = more(w.handRecruit, 1.4);
      w.recruitPlan = 2 * strength;
      break;
    case Agenda.Ideology:
      w.victory.ideological = more(w.victory.ideological, 2.2);
      w.monuments = more(w.monuments, 1.5);
      break;
    case Agenda.Monuments: {
      // Each card toward the monument counts; building must be worth more than the full set
      // it spends, or it would hoard for ever.
      w.monumentPlan = 10 * strength;
      w.monuments += w.monumentPlan * 5 ** 1.3 + 12 * strength;
      w.victory.cultural = more(w.victory.cultural, 1.8);
      break;
    }
    case Agenda.Diplomacy:
      w.victory.diplomatic = more(w.victory.diplomatic, 2);
      break;
  }
  return w;
}

/**
 * Its own leaning toward an agenda, fixed for the game: a draw from the deal (so each game
 * differs) nudged by its party (its symbol, its monument).
 */
function leaning(state: GameState, seat: PlayerId, agenda: AgendaId): number {
  let value = hash01(state.seed, seat, ALL.indexOf(agenda));
  const partyId = state.players[seat].partyId;
  if (partyId) {
    const party = getParty(partyId);
    if (agenda === Agenda.Ideology) value += 0.15;
    if (agenda === Agenda.Monuments && party.guaranteedMonumentId !== MonumentId.RomanBasilica) value += 0.1;
    if (agenda === Agenda.Elections && party.guaranteedMonumentId === MonumentId.RomanBasilica) value += 0.3;
    if (agenda === Agenda.Decrees && party.guaranteedMonumentId === MonumentId.SmartDoctrine) value += 0.2;
  }
  return value;
}

/** How promising an agenda looks on the board now (about 0 → 1). */
function prospect(state: GameState, seat: PlayerId, agenda: AgendaId): number {
  const opponent = otherPlayer(seat);
  const me = state.players[seat];
  const them = state.players[opponent];
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const race = victoryRace(state);
  const standing = (kind: VictoryKindId) => race.rows.find((row) => row.kind === kind)?.standing[seat];
  switch (agenda) {
    case Agenda.Elections: {
      const tally = state.phase === "setup" ? null : tallyElection(state);
      const lead = tally ? tally.electorates[seat] - tally.electorates[opponent] : 0;
      return clamp(0.35 + lead / 6 + 0.12 * (me.electionWins - them.electionWins));
    }
    case Agenda.Decrees: {
      const active = activeDecrees(state).length;
      return clamp(0.15 + 0.3 * satisfiedDecrees(state, seat).length + 0.08 * active + 0.08 * (me.electionWins - them.electionWins));
    }
    case Agenda.Military:
      return clamp((me.partisans - them.partisans + 1.5) / 4.5 + (recruitReady(state, seat) ? 0.15 : 0));
    case Agenda.Popularity: {
      const popularity = standing(VictoryKind.Popularity);
      return clamp(0.1 + (popularity ? popularity.value / popularity.target : 0));
    }
    case Agenda.Ideology: {
      const ideology = standing(VictoryKind.Ideological);
      // Without more private copies of some symbol it can't win this way.
      return ideology?.symbol ? clamp(ideology.value / ideology.target) : 0;
    }
    case Agenda.Monuments:
      return clamp(0.8 * monumentSet(state, seat) / 5 + 0.15 * (me.monuments.length - them.monuments.length));
    case Agenda.Diplomacy: {
      const diplomacy = standing(VictoryKind.Diplomatic);
      return diplomacy ? clamp(0.1 + diplomacy.value / diplomacy.target) : 0;
    }
  }
}

/**
 * How far `seat` has come along an agenda's road (about −1 → 1), for Ty: its learned
 * evaluator judges the whole board, and this nudges it toward the agenda when plans are close.
 * Cheap on purpose (it runs on every position its search looks at).
 */
export function agendaProgress(state: GameState, seat: PlayerId, agenda: AgendaId): number {
  // Nothing to measure before the game starts (no first player yet for an election tally).
  if (state.phase === "setup") return 0;
  const opponent = otherPlayer(seat);
  const me = state.players[seat];
  const them = state.players[opponent];
  const clip = (value: number) => Math.max(-1, Math.min(1, value));
  switch (agenda) {
    case Agenda.Military:
      return clip((me.partisans - them.partisans) / 3);
    case Agenda.Popularity: {
      let best = -Infinity;
      for (const district of state.districtOrder) best = Math.max(best, supportCount(state, seat, district) - supportCount(state, opponent, district));
      return clip(best / 9);
    }
    case Agenda.Elections: {
      const tally = tallyElection(state);
      return clip((tally.electorates[seat] - tally.electorates[opponent]) / 3 + 0.3 * (me.electionWins - them.electionWins));
    }
    case Agenda.Decrees:
      return clip(0.5 * satisfiedDecrees(state, seat).length + 0.15 * DECREES.filter((decree) => meetsDecree(state, seat, decree)).length - 0.4);
    case Agenda.Ideology:
      return ideologyRoad(state, seat);
    case Agenda.Monuments:
      return clip(0.5 * (me.monuments.length - them.monuments.length) + monumentSet(state, seat) / 10);
    case Agenda.Diplomacy:
      return clip(relationLeads(state, seat) / 3);
  }
}

const DECREES = Object.values(DecreeId);

const DECREE_OF = new Map<SymbolId, string>(DECREES.map((decree) => [decreeSymbol(decree), decree]));
const MONUMENT_SYMBOLS = new Map<string, readonly SymbolId[]>(MONUMENTS.map((monument) => [monument.id, monument.symbols]));

/**
 * How far along the road to Ideological Victory `seat` is (−1 → 1), counting the copies it can
 * still get, not only the ones in play: each symbol's total, plus part of a copy for each of its
 * policies one proposal away (less for two: a policy goes through neutral), its decree while
 * elections remain, and a monument of it up for building; less the symbol that leads it. Setup
 * counts too: how ready the seat's cards are to pass a proposal in each of those districts (the
 * share of the Senate's votes they convince, more if they open that district). A symbol counts in
 * full with more private copies than the opponent, half when level. Without the readiness part a
 * leaning player reached one copy short but was seldom able to propose the last one.
 */
export function ideologyRoad(state: GameState, seat: PlayerId): number {
  if (state.phase === "setup") return 0;
  const mine = privateSymbols(state, seat);
  const theirs = privateSymbols(state, otherPlayer(seat));
  const totals = totalSymbols(state);
  const active = new Set<string>(activeDecrees(state));
  const electionsLeft = GENERAL_ELECTION_COUNT - state.electionsOut.length;
  const reveal = bestReveal(state, handLikeCards(state, seat, { market: false })).map((card) => card.cardId);
  const share = Math.min(1, convincedVotes(state, reveal) / senateVotesNeeded(state));
  const opens = proposalDistricts(state, reveal);
  const ready = (district: DistrictId) => share * (opens.has(district) ? 1 : 0.4);
  let best = -1;
  for (const symbol of SYMBOLS) {
    const lead = mine[symbol] - theirs[symbol];
    const weight = lead > 0 ? 1 : lead === 0 ? 0.5 : 0.15;
    let reach = totals[symbol];
    for (const policy of POLICIES) {
      if (policy.symbol !== symbol || iconsDisabled(state, policy.district)) continue;
      const now = state.policy[policy.district];
      if (now === null) reach += 0.6 + 0.35 * ready(policy.district);
      else if (now !== policy.id) reach += 0.3 + 0.15 * ready(policy.district);
    }
    if (!active.has(DECREE_OF.get(symbol)!) && electionsLeft > 0) reach += 0.6;
    if (state.availableMonuments.some((monument) => MONUMENT_SYMBOLS.get(monument.cardId)?.includes(symbol))) reach += 0.2;
    const others = Math.max(...SYMBOLS.filter((other) => other !== symbol).map((other) => totals[other]));
    best = Math.max(best, weight * Math.max(-1, Math.min(1, (reach - Math.max(IDEOLOGICAL_COUNT, others + 1) + 2) / 3)));
  }
  return best;
}

/** Three cards of a district it already has support in: a recruit in hand. */
function recruitReady(state: GameState, seat: PlayerId): boolean {
  const counts = districtCounts(state, seat);
  return [...counts].some(([district, count]) => count >= 3 && canRecruitIn(state, seat, district));
}

/**
 * The most cards it has toward a monument up for building: its cards of that district, plus the
 * cards funding it (each lowers its cost by 1, for either player), up to the 5 it costs.
 */
function monumentSet(state: GameState, seat: PlayerId): number {
  const counts = districtCounts(state, seat);
  let most = 0;
  for (const monument of state.availableMonuments) {
    const def = getCard(monument.cardId);
    if ("district" in def) most = Math.max(most, Math.min(5, (counts.get(def.district) ?? 0) + fundedCards(state, monument.instanceId).length));
  }
  return most;
}

function districtCounts(state: GameState, seat: PlayerId): Map<DistrictId, number> {
  const counts = new Map<DistrictId, number>();
  for (const card of [...state.players[seat].hand, ...state.players[seat].network]) {
    const def = getCard(card.cardId);
    if ("district" in def) counts.set(def.district, (counts.get(def.district) ?? 0) + 1);
  }
  return counts;
}

/** A number in [0, 1) fixed by the deal, the seat, and a salt. */
function hash01(seed: number, seat: PlayerId, salt: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const part of [seat + 1, salt + 17]) {
    h = Math.imul(h ^ part, 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
  }
  return h / 2 ** 32;
}
