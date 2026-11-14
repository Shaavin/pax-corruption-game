/**
 * Free actions (alliances and monuments, once per source per turn, action step
 * only) and setting cards aside (Planet Next, Consultative Office).
 */
import { getCard } from "../cards/catalog.ts";
import { EffectId } from "../cards/effects.ts";
import { CardKind, District, MonumentId, PolicyId, type DistrictId } from "../cards/schema.ts";
import { activeAlliances, alliancesInPlay, handLimit, martialLawBlocks, ownsMonument, policyActive } from "./abilities.ts";
import { discardCards } from "./discard.ts";
import { drawToHand, removeFromMarket } from "./draw.ts";
import { IllegalActionError } from "./errors.ts";
import { proceed } from "./income.ts";
import { canRecruitIn, combinations, handCardsInDistrict, handLikeCards, printedDistrict, takeHandLike } from "./main.ts";
import { construct, laneEntryTriggers, proposePolicy, recruit, seatSenator } from "./plays.ts";
import type { Rng } from "./rng.ts";
import { policyTargets, revealPasses } from "./senate.ts";
import {
  Phase,
  type FreeActionAction,
  type GameEvent,
  type GameState,
  type PlayerId,
  type SetAsideAction,
} from "./types.ts";
import { isEventCard, marketTakeSources, revealDistricts } from "./world.ts";

export const ARCHITECTURE_COST = 4;

type Ability = FreeActionAction["ability"];

const ABILITY_OF: Partial<Record<string, Ability>> = {
  [EffectId.DrawToHandLimitEndActionSkipIncome]: "kybernetik",
  [EffectId.InfluenceSenateThenDraw]: "foreignInc",
  [EffectId.ReplaceAllianceUnmatched]: "centuryInc",
  [EffectId.ConstructMonumentFourMatching]: "architectureInc",
  [EffectId.RecruitPartisansFree]: "rebelInc",
  [EffectId.ProposePolicyFree]: "capitolInc",
  [EffectId.InspectTopFiveMoveOneToTop]: "intelNetwork",
};

export type FreeActionSource = {
  /** Instance id of the card granting the action. */
  source: string;
  cardId: string;
  ability: Ability;
  /** Printed district of the source (Foreign Inc. uses it). */
  district: DistrictId | null;
};

/** Live, unused free-action sources for `player` (ignores whether the action has a legal use). */
export function freeActionSources(state: GameState, player: PlayerId): FreeActionSource[] {
  if (state.phase !== Phase.Action || state.activePlayer !== player || state.pending.length > 0) return [];
  const used = new Set(state.turn.freeActionsUsed);
  const sources: FreeActionSource[] = [];
  for (const alliance of activeAlliances(state)) {
    if (alliance.owner !== player || used.has(alliance.card.instanceId)) continue;
    for (const effectId of alliance.effectIds) {
      const ability = ABILITY_OF[effectId];
      if (ability) {
        sources.push({ source: alliance.card.instanceId, cardId: alliance.card.cardId, ability, district: alliance.printed });
      }
    }
  }
  for (const monument of state.players[player].monuments) {
    if (used.has(monument.instanceId)) continue;
    const def = getCard(monument.cardId);
    if (def.kind !== CardKind.Monument) continue;
    for (const effect of def.effects) {
      const ability = ABILITY_OF[effect.id];
      if (ability) sources.push({ source: monument.instanceId, cardId: monument.cardId, ability, district: def.district });
    }
  }
  // East events (expansion): "As a free action, take a <district> card from Market."
  for (const event of marketTakeSources(state, player)) {
    if (used.has(event.card.instanceId)) continue;
    sources.push({ source: event.card.instanceId, cardId: event.card.cardId, ability: "eastTake", district: event.district });
  }
  return sources;
}

/** Market cards an East "take" may pick: non-event cards of its district, while under the hand limit. */
export function eastTakeTargets(state: GameState, player: PlayerId, district: DistrictId | null): string[] {
  if (state.players[player].hand.length >= handLimit(state, player)) return [];
  return state.market
    .filter((card) => !isEventCard(card) && printedDistrictOrNull(card.cardId) === district)
    .map((card) => card.instanceId);
}

/**
 * Every legal free action, one entry per distinct choice. Large spaces
 * (Architecture / Rebel card combinations, proposals) list representatives;
 * `applyFreeAction` validates any choice.
 */
export function freeActions(state: GameState, player: PlayerId): FreeActionAction[] {
  const actions: FreeActionAction[] = [];
  const base = { type: "freeAction" as const, player };
  for (const entry of freeActionSources(state, player)) {
    const source = entry.source;
    switch (entry.ability) {
      case "kybernetik":
        if (state.players[player].hand.length < handLimit(state, player)) {
          actions.push({ ...base, source, ability: "kybernetik" });
        }
        break;
      case "foreignInc":
        for (const card of handLikeCards(state, player, { market: false })) {
          if (printedDistrictOrNull(card.cardId) === entry.district) {
            actions.push({ ...base, source, ability: "foreignInc", instanceId: card.instanceId });
          }
        }
        break;
      case "centuryInc": {
        const mine = handLikeCards(state, player, { market: false }).filter(
          (card) => getCard(card.cardId).kind === CardKind.Alliance,
        );
        for (const card of mine) {
          for (const target of alliancesInPlay(state)) {
            actions.push({
              ...base,
              source,
              ability: "centuryInc",
              instanceId: card.instanceId,
              target: { owner: target.owner, instanceId: target.card.instanceId },
            });
          }
        }
        break;
      }
      case "architectureInc":
        for (const district of state.districtOrder) {
          if (martialLawBlocks(state, [district, district])) continue;
          const ids = handCardsInDistrict(state, player, district).map((card) => card.instanceId);
          const combo = combinations(ids, ARCHITECTURE_COST)[0];
          if (!combo) continue;
          for (const monument of state.availableMonuments) {
            if (printedDistrict(monument.cardId) === district) {
              actions.push({ ...base, source, ability: "architectureInc", instanceIds: combo, monumentInstanceId: monument.instanceId });
            }
          }
        }
        break;
      case "rebelInc":
        for (const district of state.districtOrder) {
          if (martialLawBlocks(state, [district, district]) || !canRecruitIn(state, player, district)) continue;
          const ids = handCardsInDistrict(state, player, district).map((card) => card.instanceId);
          const combo = combinations(ids, 3)[0];
          if (combo) actions.push({ ...base, source, ability: "rebelInc", instanceIds: combo });
        }
        break;
      case "capitolInc": {
        const cards = handLikeCards(state, player, { market: false });
        const cardIds = cards.map((card) => card.cardId);
        if (cards.length > 0 && revealPasses(state, cardIds)) {
          for (const target of policyTargets(state)) {
            actions.push({
              ...base,
              source,
              ability: "capitolInc",
              revealIds: cards.map((card) => card.instanceId),
              discardId: cards[0]!.instanceId,
              district: target.district,
              policyId: target.policyId,
            });
          }
        }
        break;
      }
      case "intelNetwork":
        if (state.deck.length > 0) actions.push({ ...base, source, ability: "intelNetwork" });
        break;
      case "eastTake":
        for (const instanceId of eastTakeTargets(state, player, entry.district)) {
          actions.push({ ...base, source, ability: "eastTake", instanceId });
        }
        break;
    }
  }
  return actions;
}

export function hasFreeAction(state: GameState): boolean {
  return freeActions(state, state.activePlayer).length > 0;
}

function printedDistrictOrNull(cardId: string): DistrictId | null {
  const def = getCard(cardId);
  return "district" in def ? def.district : null;
}

export function applyFreeAction(state: GameState, action: FreeActionAction, rng: Rng, events: GameEvent[]): void {
  if (state.phase !== Phase.Action) throw new IllegalActionError("Free actions happen in the action step");
  const entry = freeActionSources(state, action.player).find(
    (source) => source.source === action.source && source.ability === action.ability,
  );
  if (!entry) throw new IllegalActionError("That free action isn't available");
  state.turn.freeActionsUsed.push(action.source);
  events.push({ type: "freeActionUsed", player: action.player, sourceCardId: entry.cardId, ability: action.ability });
  const player = action.player;

  switch (action.ability) {
    case "kybernetik": {
      // "Draw to hand limit. If you do, end your action step and skip income step this turn."
      while (state.players[player].hand.length < handLimit(state, player)) {
        if (!drawToHand(state, player, events)) break;
      }
      state.turn.skipIncome = true;
      state.turn.mainActionDone = true;
      proceed(state, "politics", events);
      return;
    }
    case "foreignInc": {
      const card = handLikeCards(state, player, { market: false }).find((entry) => entry.instanceId === action.instanceId);
      if (!card || printedDistrictOrNull(card.cardId) !== entry.district) {
        throw new IllegalActionError("Foreign Inc. seats a card of its own district");
      }
      seatSenator(state, player, action.instanceId, events);
      drawToHand(state, player, events);
      break;
    }
    case "centuryInc":
      replaceAlliance(state, player, action.instanceId, action.target, events);
      break;
    case "architectureInc":
      construct(state, player, action.instanceIds, action.monumentInstanceId, ARCHITECTURE_COST, rng, events);
      break;
    case "rebelInc":
      recruit(state, player, action.instanceIds, events);
      break;
    case "eastTake": {
      if (!eastTakeTargets(state, player, entry.district).includes(action.instanceId)) {
        throw new IllegalActionError("Take a non-event Market card of that district, while under your hand limit");
      }
      const card = removeFromMarket(state, action.instanceId);
      state.players[player].hand.push({ ...card, faceUp: true });
      events.push({ type: "marketTaken", player, instanceId: card.instanceId, cardId: card.cardId });
      break;
    }
    case "capitolInc":
      proposePolicy(state, player, action.revealIds, action.discardId, action.district, action.policyId, events);
      break;
    case "intelNetwork":
      state.pending.push({
        kind: "intelNetwork",
        player,
        instanceIds: state.deck.slice(0, 5).map((card) => card.instanceId),
      });
      break;
  }
  proceed(state, "afterFree", events);
}

/**
 * Century Inc.: play an alliance from hand over an existing one. The replaced
 * card goes to the support pile of the player whose tableau held it; in the
 * opponent's tableau the new alliance becomes theirs.
 */
function replaceAlliance(
  state: GameState,
  player: PlayerId,
  instanceId: string,
  target: { owner: PlayerId; instanceId: string },
  events: GameEvent[],
): void {
  const incoming = handLikeCards(state, player, { market: false }).find((card) => card.instanceId === instanceId);
  if (!incoming || getCard(incoming.cardId).kind !== CardKind.Alliance) {
    throw new IllegalActionError("Century Inc. plays an alliance from your hand");
  }
  const lanes = state.players[target.owner].tableau;
  const lane = state.districtOrder.find((district) =>
    lanes[district].some((card) => card.instanceId === target.instanceId && getCard(card.cardId).kind === CardKind.Alliance),
  );
  if (!lane) throw new IllegalActionError("Century Inc. must replace an alliance in play");

  const card = takeHandLike(state, player, instanceId, { market: false });
  const replaced = lanes[lane].find((entry) => entry.instanceId === target.instanceId)!;
  lanes[lane] = lanes[lane].filter((entry) => entry.instanceId !== target.instanceId);
  const placed = { ...card, faceUp: true, occupiedDistrict: lane };
  lanes[lane].push(placed);
  events.push({
    type: "allianceReplaced",
    player,
    owner: target.owner,
    cardId: placed.cardId,
    replacedCardId: replaced.cardId,
    district: lane,
  });
  discardCards(state, player, [{ card: replaced, owner: target.owner }], events);
  laneEntryTriggers(state, player, placed, events);
}

// --- Setting cards aside -------------------------------------------------------------

const ZONE_DISTRICT: Record<"planetNextBank" | "consultativeOffice", DistrictId> = {
  planetNextBank: District.Horsard,
  consultativeOffice: District.Smarbbit,
};

/** Districts a zone accepts for `player`. East reveal: districts named by their East events. */
function zoneDistricts(state: GameState, player: PlayerId, zone: SetAsideAction["zone"]): DistrictId[] {
  return zone === "eastReveal" ? revealDistricts(state, player) : [ZONE_DISTRICT[zone]];
}

/** Which set-aside zones `player` may use right now (own turn, no pending choice). */
export function setAsideZones(state: GameState, player: PlayerId): SetAsideAction["zone"][] {
  const ownTurn =
    state.activePlayer === player &&
    state.pending.length === 0 &&
    (state.phase === Phase.Action || state.phase === Phase.Politics || state.phase === Phase.Income);
  if (!ownTurn) return [];
  const zones: SetAsideAction["zone"][] = [];
  if (ownsMonument(state, player, MonumentId.PlanetNext)) zones.push("planetNextBank");
  if (policyActive(state, PolicyId.SmarbbitB)) zones.push("consultativeOffice");
  if (revealDistricts(state, player).length > 0) zones.push("eastReveal");
  return zones.filter((zone) => {
    const districts = zoneDistricts(state, player, zone);
    return state.players[player].hand.some((card) => districts.includes(printedDistrictOrNull(card.cardId)!));
  });
}

export function setAsideActions(state: GameState, player: PlayerId): SetAsideAction[] {
  return setAsideZones(state, player).flatMap((zone) => {
    const districts = zoneDistricts(state, player, zone);
    return state.players[player].hand
      .filter((card) => districts.includes(printedDistrictOrNull(card.cardId)!))
      .map((card) => ({ type: "setAside" as const, player, zone, instanceIds: [card.instanceId] }));
  });
}

export function applySetAside(state: GameState, action: SetAsideAction, events: GameEvent[]): void {
  if (!setAsideZones(state, action.player).includes(action.zone)) {
    throw new IllegalActionError("You can't set cards aside there right now");
  }
  const seat = state.players[action.player];
  const districts = zoneDistricts(state, action.player, action.zone);
  const cards = action.instanceIds.map((id) => {
    const card = seat.hand.find((entry) => entry.instanceId === id);
    if (!card || !districts.includes(printedDistrictOrNull(card.cardId)!)) {
      throw new IllegalActionError(`Only ${districts.join(" or ")} cards from your hand can go there`);
    }
    return card;
  });
  seat.hand = seat.hand.filter((card) => !action.instanceIds.includes(card.instanceId));
  const faceUp = cards.map((card) => ({ ...card, faceUp: true }));
  if (action.zone === "eastReveal") state.expansion!.revealed[action.player].push(...faceUp);
  else seat[action.zone].push(...faceUp);
  events.push({ type: "cardsSetAside", player: action.player, zone: action.zone, cardIds: cards.map((card) => card.cardId) });
}
