/**
 * Legacy & Diplomacy queries: which events are in effect and what they change.
 * Low-level on purpose (types + catalog only) so any engine module can use it
 * without import cycles. Rulings: docs/agents/open-questions.md (2026-11-13).
 */
import {
  getEvent,
  isEventId,
  WORLD_POWERS,
  type EventEffect,
  type ExpansionVictoryId,
  type RegularEventCard,
} from "../cards/expansion.ts";
import type { DecreeIdValue, DistrictId } from "../cards/schema.ts";
import { VictoryKind, type CardInstance, type GameState, type PlayerId, type VictoryKindId } from "./types.ts";

export type ActiveEvent = { card: CardInstance; def: RegularEventCard; owner: PlayerId | null };

/** Regular events in the common area (played for their effect). */
export function activeEvents(state: GameState): ActiveEvent[] {
  if (!state.expansion) return [];
  const result: ActiveEvent[] = [];
  for (const played of state.expansion.commonArea) {
    const def = getEvent(played.card.cardId);
    if (!def.legacy) result.push({ card: played.card, def, owner: played.owner });
  }
  return result;
}

function effectsOf<T extends EventEffect["type"]>(
  state: GameState,
  type: T,
): (ActiveEvent & { effect: Extract<EventEffect, { type: T }> })[] {
  return activeEvents(state)
    .filter((entry) => entry.def.effect.type === type)
    .map((entry) => ({ ...entry, effect: entry.def.effect as Extract<EventEffect, { type: T }> }));
}

/** East effects belong to their buyer; Foreign Influence setup events (owner null) to everyone. */
function benefits(owner: PlayerId | null, player: PlayerId): boolean {
  return owner === null || owner === player;
}

/** Is this Market (or common area) card an expansion event? */
export function isEventCard(card: CardInstance): boolean {
  return isEventId(card.cardId);
}

/** Market cards that are not events. */
export function marketNonEvents(state: GameState): CardInstance[] {
  return state.market.filter((card) => !isEventCard(card));
}

// --- West ------------------------------------------------------------------------------

/** West "District support in <district> remains at zero": support counts as 0 for both players. */
export function supportZeroed(state: GameState, district: DistrictId): boolean {
  return effectsOf(state, "supportZero").some((entry) => entry.effect.district === district);
}

/** A player's support in a district, as every rule reads it. */
export function supportCount(state: GameState, player: PlayerId, district: DistrictId): number {
  if (supportZeroed(state, district)) return 0;
  return state.players[player].support[district].length;
}

/** West "Disable all icons in <district> for ideological victory". */
export function iconsDisabled(state: GameState, district: DistrictId): boolean {
  return effectsOf(state, "disableIcons").some((entry) => entry.effect.district === district);
}

// --- South -----------------------------------------------------------------------------

/** South "Influence in <district> is now reduced to player's support". */
export function influenceIsSupport(state: GameState, district: DistrictId): boolean {
  return effectsOf(state, "influenceIsSupport").some((entry) => entry.effect.district === district);
}

/** South "<district> cards in Senate are always convinced" (conspiracies too). */
export function senateAlwaysConvinced(state: GameState, district: DistrictId): boolean {
  return effectsOf(state, "senateConvinced").some((entry) => entry.effect.district === district);
}

// --- North -----------------------------------------------------------------------------

/** North "Military victory now requires +1 partisans to declare" — they stack. */
export function militaryLeadBonus(state: GameState): number {
  return effectsOf(state, "militaryLead").length;
}

/** North "Flip over Pax <decree> to the other side, when in effect": odd count = flipped. */
export function decreeFlipped(state: GameState, decree: DecreeIdValue): boolean {
  return effectsOf(state, "flipDecree").filter((entry) => entry.effect.decree === decree).length % 2 === 1;
}

// --- East ------------------------------------------------------------------------------

/** Districts whose cards `player` may keep face-up outside the hand limit. */
export function revealDistricts(state: GameState, player: PlayerId): DistrictId[] {
  return effectsOf(state, "handLimitExempt")
    .filter((entry) => benefits(entry.owner, player))
    .map((entry) => entry.effect.district);
}

/** East "As a free action, take a <district> card from Market" sources for `player`. */
export function marketTakeSources(state: GameState, player: PlayerId): (ActiveEvent & { district: DistrictId })[] {
  return effectsOf(state, "takeFromMarket")
    .filter((entry) => benefits(entry.owner, player))
    .map((entry) => ({ ...entry, district: entry.effect.district }));
}

// --- Victories and relations -------------------------------------------------------------

const TOGGLED: readonly VictoryKindId[] = [
  VictoryKind.Military,
  VictoryKind.Popularity,
  VictoryKind.Ideological,
  VictoryKind.Cultural,
  VictoryKind.Diplomatic,
];

/**
 * Base game: the five base victories are always active. Expansion: Civil and
 * Political stay active; the other five start inactive until a legacy event flips them.
 */
export function victoryActive(state: GameState, kind: VictoryKindId): boolean {
  if (!state.expansion) {
    return kind !== VictoryKind.Cultural && kind !== VictoryKind.Diplomatic;
  }
  if (!TOGGLED.includes(kind)) return true;
  return state.expansion.activeVictories.includes(kind as ExpansionVictoryId);
}

/** Powers where `player`'s relation is strictly higher than the opponent's. */
export function relationLeads(state: GameState, player: PlayerId): number {
  if (!state.expansion) return 0;
  const mine = state.expansion.relations[player];
  const theirs = state.expansion.relations[player === 0 ? 1 : 0];
  return WORLD_POWERS.filter((power) => mine[power] > theirs[power]).length;
}
