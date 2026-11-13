/**
 * Legacy & Diplomacy: event deck setup, buying events at income, legacy events,
 * and removing events from play. Rules: the expansion rulebook plus the rulings
 * in docs/agents/open-questions.md (2026-11-13). Queries live in world.ts.
 */
import { getCard } from "../cards/catalog.ts";
import {
  EVENTS,
  EVENTS_REMOVED_PER_POWER,
  ExpansionVictory,
  getEvent,
  WORLD_POWERS,
  type ExpansionVictoryId,
  type WorldPowerId,
} from "../cards/expansion.ts";
import type { DistrictId } from "../cards/schema.ts";
import { handLimit, martialLawBlocks } from "./abilities.ts";
import { discardCards } from "./discard.ts";
import { drawToHand, eventCost, removeFromMarket } from "./draw.ts";
import { IllegalActionError } from "./errors.ts";
import { handLikeCards, takeHandLike } from "./main.ts";
import { laneEntryTriggers } from "./plays.ts";
import type { Rng } from "./rng.ts";
import {
  Phase,
  type BuyEventAction,
  type CardInstance,
  type EventUse,
  type ExpansionState,
  type GameEvent,
  type GameState,
  type PlayerId,
} from "./types.ts";
import { isEventCard, revealDistricts } from "./world.ts";

export type ExpansionOptions = { expansion?: boolean; foreignInfluence?: boolean };

const EXPANSION_VICTORIES = Object.values(ExpansionVictory);

/** Each event exists once, so its id makes a stable instance id. */
function eventInstance(cardId: string): CardInstance {
  return { instanceId: `ev-${cardId}`, cardId, faceUp: true };
}

/**
 * Expansion setup step 7 (after the base setup has used the RNG, so base games
 * deal exactly as before): set the 8 legacy events aside, remove 3 random
 * regular events per World Power, shuffle the rest with the legacy events.
 * Foreign Influence variant: 3 random regular events start in play, owned by no one.
 */
export function setUpExpansion(state: GameState, rng: Rng, foreignInfluence: boolean): GameEvent[] {
  const box: CardInstance[] = [];
  const kept: CardInstance[] = [];
  for (const power of WORLD_POWERS) {
    const regular = rng.shuffle(EVENTS.filter((event) => event.power === power && !event.legacy));
    box.push(...regular.slice(0, EVENTS_REMOVED_PER_POWER).map((event) => eventInstance(event.id)));
    kept.push(...regular.slice(EVENTS_REMOVED_PER_POWER).map((event) => eventInstance(event.id)));
  }
  const commonArea: ExpansionState["commonArea"] = [];
  let pool = kept;
  if (foreignInfluence) {
    pool = rng.shuffle(kept);
    commonArea.push(...pool.slice(0, 3).map((card) => ({ card, owner: null })));
    pool = pool.slice(3);
  }
  const legacy = EVENTS.filter((event) => event.legacy).map((event) => eventInstance(event.id));
  const eventDeck = rng.shuffle([...pool, ...legacy]);
  const zeros = () => Object.fromEntries(WORLD_POWERS.map((power) => [power, 0])) as Record<WorldPowerId, number>;

  state.expansion = {
    foreignInfluence,
    eventDeck,
    box,
    commonArea,
    relations: { 0: zeros(), 1: zeros() },
    activeVictories: [],
    revealed: { 0: [], 1: [] },
    turnMarket: [],
    eventCosts: {},
    rowBreak: null,
    turnRows: null,
  };
  return [];
}

// --- Buying ------------------------------------------------------------------------------

/** Market events `player` could buy right now (income step, under the hand limit). */
export function buyableEvents(state: GameState, player: PlayerId): CardInstance[] {
  return canBuyNow(state, player) ? affordableEvents(state, player) : [];
}

/** Market events `player` has enough cards to pay for (ignores phase and hand limit). */
export function affordableEvents(state: GameState, player: PlayerId): CardInstance[] {
  if (!state.expansion) return [];
  const purse = handLikeCards(state, player, { market: false }).length;
  return state.market.filter((card) => isEventCard(card) && eventCost(state, card.instanceId) <= purse);
}

function canBuyNow(state: GameState, player: PlayerId): boolean {
  return (
    state.expansion !== null &&
    state.phase === Phase.Income &&
    state.activePlayer === player &&
    state.pending.length === 0 &&
    state.players[player].hand.length < handLimit(state, player)
  );
}

/** The ways an event can be played. Legacy activation needs an inactive victory. */
export function eventUses(state: GameState, cardId: string): { use: EventUse; victory?: ExpansionVictoryId }[] {
  const def = getEvent(cardId);
  if (!def.legacy) return [{ use: "effect" }, { use: "civil" }];
  const inactive = EXPANSION_VICTORIES.filter((victory) => !state.expansion!.activeVictories.includes(victory));
  return [{ use: "legacyDiscard" }, ...inactive.map((victory) => ({ use: "legacyActivate" as const, victory }))];
}

/** One representative legal buy per event and use (any affordable payment). */
export function buyEventActions(state: GameState, player: PlayerId): BuyEventAction[] {
  const purse = handLikeCards(state, player, { market: false });
  return buyableEvents(state, player).flatMap((card) => {
    const payIds = payment(state, purse, eventCost(state, card.instanceId));
    if (!payIds) return [];
    return eventUses(state, card.cardId).map((use) => ({
      type: "buyEvent" as const,
      player,
      instanceId: card.instanceId,
      payIds,
      ...use,
    }));
  });
}

/** Some payment of `cost` cards that Martial Law allows, or null. */
function payment(state: GameState, purse: CardInstance[], cost: number): string[] | null {
  if (cost === 0) return [];
  const shavvinne = purse.filter((card) => districtOf(card) === "shavvinne");
  const others = purse.filter((card) => districtOf(card) !== "shavvinne");
  const ordered = [...others, ...shavvinne];
  const pick = ordered.slice(0, cost);
  if (pick.length < cost) return null;
  if (martialLawBlocks(state, pick.map(districtOf).filter((d): d is DistrictId => d !== null))) return null;
  return pick.map((card) => card.instanceId);
}

function districtOf(card: CardInstance): DistrictId | null {
  const def = getCard(card.cardId);
  return "district" in def ? def.district : null;
}

/**
 * Income option B. Pay one card per non-event card to the event's right (to your
 * support piles), gain 1 relation with its World Power, and play it at once.
 */
export function applyBuyEvent(state: GameState, action: BuyEventAction, events: GameEvent[]): void {
  const { player } = action;
  if (!canBuyNow(state, player)) throw new IllegalActionError("You can buy an event only at income, under your hand limit");
  const expansion = state.expansion!;
  const card = state.market.find((entry) => entry.instanceId === action.instanceId);
  if (!card || !isEventCard(card)) throw new IllegalActionError("That event is not in the Market");
  const cost = eventCost(state, card.instanceId);
  if (new Set(action.payIds).size !== action.payIds.length || action.payIds.length !== cost) {
    throw new IllegalActionError(`This event costs ${cost} card${cost === 1 ? "" : "s"}`);
  }
  const purse = handLikeCards(state, player, { market: false });
  const paid = action.payIds.map((id) => {
    const entry = purse.find((candidate) => candidate.instanceId === id);
    if (!entry) throw new IllegalActionError("Pay with cards from your hand");
    return entry;
  });
  if (martialLawBlocks(state, paid.map(districtOf).filter((d): d is DistrictId => d !== null))) {
    throw new IllegalActionError("Martial Law: you can't discard 2 or more Shavvinne cards at once");
  }
  const def = getEvent(card.cardId);
  const use = eventUses(state, card.cardId).find(
    (entry) => entry.use === action.use && (entry.victory ?? null) === (action.victory ?? null),
  );
  if (!use) throw new IllegalActionError("That event can't be played that way");

  removeFromMarket(state, card.instanceId);
  events.push({ type: "eventBought", player, cardId: card.cardId, use: action.use, cost });
  const cards = action.payIds.map((id) => takeHandLike(state, player, id, { market: false }));
  discardCards(state, player, cards.map((entry) => ({ card: entry, owner: player })), events);

  expansion.relations[player][def.power] += 1;
  events.push({ type: "relationGained", player, power: def.power, relation: expansion.relations[player][def.power] });

  switch (action.use) {
    case "effect":
      expansion.commonArea.push({ card: { ...card, faceUp: true }, owner: player });
      // House rule (2026-11-12): playing a bought event for its effect draws a card.
      drawToHand(state, player, events);
      break;
    case "civil": {
      if (def.legacy) throw new IllegalActionError("Legacy events have no civil side");
      const placed = { ...card, faceUp: true, occupiedDistrict: def.district };
      state.players[player].tableau[def.district].push(placed);
      laneEntryTriggers(state, player, placed, events);
      break;
    }
    case "legacyDiscard":
      expansion.box.push({ ...card, faceUp: true });
      removePowerEvents(state, def.power, events);
      break;
    case "legacyActivate":
      expansion.box.push({ ...card, faceUp: true });
      expansion.activeVictories.push(action.victory!);
      events.push({ type: "victoryActivated", player, victory: action.victory! });
      break;
  }
}

/**
 * Legacy option 1: "Discard played <power> cards." Events of that power leave the
 * common area and both tableaus; all of them leave the game (ruled 2026-11-11).
 */
function removePowerEvents(state: GameState, power: WorldPowerId, events: GameEvent[]): void {
  const expansion = state.expansion!;
  const removed: CardInstance[] = [];
  expansion.commonArea = expansion.commonArea.filter((played) => {
    if (getEvent(played.card.cardId).power !== power) return true;
    removed.push(played.card);
    return false;
  });
  for (const seat of state.players) {
    for (const district of state.districtOrder) {
      seat.tableau[district] = seat.tableau[district].filter((card) => {
        if (!isEventCard(card) || getEvent(card.cardId).power !== power) return true;
        removed.push(card);
        return false;
      });
    }
  }
  if (removed.length > 0) {
    expansion.box.push(...removed.map((card) => ({ ...card, occupiedDistrict: undefined })));
    events.push({ type: "eventsRemoved", cardIds: removed.map((card) => card.cardId), reason: "legacy" });
  }
  returnUnrevealedCards(state);
}

/**
 * East "Revealed <district> cards do not occupy hand limit": once no event lets a
 * player keep a district face-up, those cards go back to their hand (provisional).
 */
export function returnUnrevealedCards(state: GameState): void {
  if (!state.expansion) return;
  for (const player of [0, 1] as const) {
    const allowed = new Set(revealDistricts(state, player));
    const zone = state.expansion.revealed[player];
    const back = zone.filter((card) => {
      const district = districtOf(card);
      return district === null || !allowed.has(district);
    });
    if (back.length === 0) continue;
    state.expansion.revealed[player] = zone.filter((card) => !back.includes(card));
    state.players[player].hand.push(...back);
  }
}
