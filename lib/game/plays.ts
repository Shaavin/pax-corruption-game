/**
 * Building blocks shared by main actions, free actions, and the Politics step.
 * Each validates, mutates the (cloned) state, and appends events. Callers handle
 * phase checks and what happens next; a thrown error discards the clone.
 */
import { getCard } from "../cards/catalog.ts";
import { EffectId } from "../cards/effects.ts";
import { CardKind, District, MonumentId, PolicyId, type DistrictId, type PolicyIdValue } from "../cards/schema.ts";
import {
  conspiracyBlocked,
  hasActiveAlliance,
  marketRegulationBlocks,
  martialLawBlocks,
  ownsMonument,
  policyActive,
  policyFrozen,
} from "./abilities.ts";
import { discardCards, discardOwn } from "./discard.ts";
import { drawToHand } from "./draw.ts";
import { IllegalActionError, asIllegal } from "./errors.ts";
import { canPlayAlliance, canRecruitIn, handLikeCards, printedDistrict, takeHandLike, takeSpend } from "./main.ts";
import type { Rng } from "./rng.ts";
import {
  convincedVotes,
  influenceSenate,
  policyOptions,
  revealedDistricts,
  revealPasses,
  senateTotalVotes,
} from "./senate.ts";
import type { CardInstance, GameEvent, GameState, PlayerId } from "./types.ts";
import { otherPlayer } from "./zones.ts";

/** Why a card can't be played right now (policy or alliance restrictions), or null. */
export function playBlockReason(state: GameState, cardId: string): string | null {
  const def = getCard(cardId);
  if (def.kind === CardKind.Civil && marketRegulationBlocks(state, cardId)) {
    return "Market Regulation: civil cards of 8 or higher can't be played in Horsard";
  }
  if (def.kind === CardKind.Conspiracy) {
    if (conspiracyBlocked(state, def.district)) {
      return "An Order of Knights blocks conspiracies in that district";
    }
    if (martialLawBlocks(state, [def.district, def.district])) {
      return "Martial Law: a Shavvinne conspiracy would discard more than 1 Shavvinne card";
    }
  }
  return null;
}

/**
 * Triggers when a card goes into a lane: Model Society (alliance → draw),
 * Currency Ballots (Dragonara card → draw, then discard one), and Urban
 * Aristocrats (Dragonara civil → optional swap).
 */
export function laneEntryTriggers(state: GameState, actor: PlayerId, card: CardInstance, events: GameEvent[]): void {
  const def = getCard(card.cardId);
  if (def.kind === CardKind.Alliance && ownsMonument(state, actor, MonumentId.ModelSociety)) {
    drawToHand(state, actor, events);
  }
  if ("district" in def && def.district === District.Dragonara && policyActive(state, PolicyId.DragonaraA)) {
    drawToHand(state, actor, events);
    if (handLikeCards(state, actor, { market: false }).length > 0) {
      state.pending.push({ kind: "discardOne", player: actor });
    }
  }
  if (
    def.kind === CardKind.Civil &&
    def.district === District.Dragonara &&
    hasActiveAlliance(state, actor, EffectId.SwapCivilAfterPlay, District.Dragonara) &&
    swapCandidates(state, actor).mine.length > 0 &&
    swapCandidates(state, actor).theirs.length > 0
  ) {
    state.pending.push({ kind: "swapCivils", player: actor });
  }
}

export function swapCandidates(state: GameState, player: PlayerId): { mine: CardInstance[]; theirs: CardInstance[] } {
  const civils = (owner: PlayerId) =>
    state.players[owner].tableau[District.Dragonara].filter((card) => getCard(card.cardId).kind === CardKind.Civil);
  return { mine: civils(player), theirs: civils(otherPlayer(player)) };
}

/** Play a civil or alliance from the hand-like zones into its printed district. */
export function playToLane(
  state: GameState,
  player: PlayerId,
  instanceId: string,
  kind: typeof CardKind.Civil | typeof CardKind.Alliance,
  events: GameEvent[],
): CardInstance {
  const available = handLikeCards(state, player, { market: kind === CardKind.Civil });
  const found = available.find((card) => card.instanceId === instanceId);
  if (!found) throw new IllegalActionError("That card is not in your hand");
  const def = getCard(found.cardId);
  if (def.kind !== kind) {
    throw new IllegalActionError(`Only ${kind} cards can be played this way`);
  }
  if (kind === CardKind.Alliance && !canPlayAlliance(state, player, def.district)) {
    throw new IllegalActionError("Alliance slot in that district is full");
  }
  const block = playBlockReason(state, found.cardId);
  if (block) throw new IllegalActionError(block);

  const card = takeHandLike(state, player, instanceId, { market: kind === CardKind.Civil });
  const played = { ...card, faceUp: true, occupiedDistrict: def.district };
  state.players[player].tableau[def.district].push(played);
  events.push({
    type: kind === CardKind.Civil ? "civilPlayed" : "alliancePlayed",
    player,
    instanceId: played.instanceId,
    cardId: played.cardId,
    district: def.district,
  });
  laneEntryTriggers(state, player, played, events);
  return played;
}

/** Conspiracy: wipe the district (both sides), then discard itself. */
export function playConspiracy(state: GameState, player: PlayerId, instanceId: string, events: GameEvent[]): void {
  const found = handLikeCards(state, player, { market: false }).find((card) => card.instanceId === instanceId);
  if (!found) throw new IllegalActionError("That card is not in your hand");
  const def = getCard(found.cardId);
  if (def.kind !== CardKind.Conspiracy) {
    throw new IllegalActionError("Only conspiracy cards can be played this way");
  }
  const block = playBlockReason(state, found.cardId);
  if (block) throw new IllegalActionError(block);
  const card = takeHandLike(state, player, instanceId, { market: false });

  const district = def.district;
  const wiped: { card: CardInstance; owner: PlayerId }[] = [];
  for (const owner of [0, 1] as const) {
    // Project Habitat: "Conspiracy no longer discards your already played civil cards in Smarbbit."
    const keepsCivils =
      district === District.Smarbbit &&
      hasActiveAlliance(state, owner, EffectId.ConspiracyKeepsYourCivil, District.Smarbbit);
    const lane = state.players[owner].tableau[district];
    const kept = keepsCivils ? lane.filter((entry) => getCard(entry.cardId).kind === CardKind.Civil) : [];
    for (const entry of lane) {
      if (!kept.includes(entry)) wiped.push({ card: entry, owner });
    }
    state.players[owner].tableau[district] = kept;
  }
  events.push({ type: "conspiracyPlayed", player, instanceId: card.instanceId, cardId: card.cardId, district });
  discardCards(state, player, [...wiped, { card, owner: player }], events);
  laneEntryTriggers(state, player, card, events);
}

/** Recruit partisans: discard 3 same-district cards (needs a card already in that pile). */
export function recruit(state: GameState, player: PlayerId, instanceIds: readonly string[], events: GameEvent[]): void {
  const preview = handLikeCards(state, player, { market: true }).filter((card) => instanceIds.includes(card.instanceId));
  if (martialLawBlocks(state, preview.map((card) => printedDistrict(card.cardId)))) {
    throw new IllegalActionError("Martial Law: actions may discard at most 1 Shavvinne card");
  }
  const spent = asIllegal(() => takeSpend(state, player, instanceIds, 3), "Illegal cards spent");
  if (!canRecruitIn(state, player, spent.district)) {
    throw new IllegalActionError("Recruiting needs a card already in your support pile for that district");
  }
  discardOwn(state, player, spent.cards, events);
  state.players[player].partisans += 1;
  events.push({ type: "partisansRecruited", player, count: state.players[player].partisans });
}

/** Construct a monument by discarding `cost` cards of its district. */
export function construct(
  state: GameState,
  player: PlayerId,
  instanceIds: readonly string[],
  monumentInstanceId: string,
  cost: number,
  rng: Rng,
  events: GameEvent[],
): void {
  const preview = handLikeCards(state, player, { market: true }).filter((card) => instanceIds.includes(card.instanceId));
  if (martialLawBlocks(state, preview.map((card) => printedDistrict(card.cardId)))) {
    throw new IllegalActionError("Martial Law: actions may discard at most 1 Shavvinne card");
  }
  const monumentIndex = state.availableMonuments.findIndex((entry) => entry.instanceId === monumentInstanceId);
  if (monumentIndex < 0) throw new IllegalActionError("That monument is not available");
  const monument = state.availableMonuments[monumentIndex]!;
  const spent = asIllegal(() => takeSpend(state, player, instanceIds, cost), "Illegal cards spent");
  if (printedDistrict(monument.cardId) !== spent.district) {
    throw new IllegalActionError("Monument district must match the cards spent");
  }
  state.availableMonuments.splice(monumentIndex, 1);
  const placed = { ...monument, faceUp: true };
  state.players[player].monuments.push(placed);
  events.push({ type: "monumentConstructed", player, instanceId: placed.instanceId, cardId: placed.cardId });
  if (state.monumentDeck.length > 0) {
    const next = state.monumentDeck.splice(rng.nextInt(state.monumentDeck.length), 1)[0]!;
    state.availableMonuments.push({ ...next, faceUp: true });
    events.push({ type: "monumentReplenished", cardId: next.cardId });
  }
  discardOwn(state, player, spent.cards, events);
  state.turn.constructedMonument = true;
}

/** Influence Senate: seat any card from hand; the rightmost Senator goes to your pile. */
export function seatSenator(state: GameState, player: PlayerId, instanceId: string, events: GameEvent[]): void {
  const card = asIllegal(() => takeHandLike(state, player, instanceId, { market: false }), "Not in hand");
  influenceSenate(state, player, card, events);
}

/** Propose Policy: reveal cards that convince a majority, discard one, change a revealed card's district. */
export function proposePolicy(
  state: GameState,
  player: PlayerId,
  revealIds: readonly string[],
  discardId: string,
  district: DistrictId,
  policyId: PolicyIdValue | null,
  events: GameEvent[],
): void {
  if (revealIds.length === 0 || new Set(revealIds).size !== revealIds.length) {
    throw new IllegalActionError("Reveal one or more distinct cards");
  }
  const available = handLikeCards(state, player, { market: false });
  const revealed = revealIds.map((id) => {
    const card = available.find((entry) => entry.instanceId === id);
    if (!card) throw new IllegalActionError("Revealed cards must come from your hand");
    return card;
  });
  if (!revealIds.includes(discardId)) {
    throw new IllegalActionError("The discarded card must be one of the revealed cards");
  }
  const revealedCardIds = revealed.map((card) => card.cardId);
  if (!revealPasses(state, revealedCardIds)) {
    throw new IllegalActionError("Those cards do not convince more than half of the Senate");
  }
  if (!state.districtOrder.includes(district)) throw new IllegalActionError("Unknown district");
  if (policyFrozen(state, district)) {
    throw new IllegalActionError("A District Governor protects that district's policy from proposals");
  }
  if (!revealedDistricts(revealedCardIds).includes(district)) {
    throw new IllegalActionError("The changed policy must be in a district of a revealed card");
  }
  if (!policyOptions(state, district).includes(policyId)) {
    throw new IllegalActionError("Policies move from neutral to a side, or from a side back to neutral");
  }
  events.push({
    type: "policyProposed",
    player,
    revealedCardIds,
    votes: convincedVotes(state, revealedCardIds),
    totalVotes: senateTotalVotes(state),
  });
  const discarded = takeHandLike(state, player, discardId, { market: false });
  discardOwn(state, player, [discarded], events);
  state.policy[district] = policyId;
  events.push({ type: "policyChanged", district, policyId, player });
}
