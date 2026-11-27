/**
 * Free actions (alliances and monuments, once per source per turn, action step
 * only). Moving cards in and out of the network lives in `network.ts`.
 */
import { getCard } from "../cards/catalog.ts";
import { EffectId } from "../cards/effects.ts";
import { CardKind, District, type DistrictId } from "../cards/schema.ts";
import { activeAlliances, alliancesInPlay, handLimit, martialLawBlocks } from "./abilities.ts";
import { discardCards } from "./discard.ts";
import { drawToHand, removeFromMarket } from "./draw.ts";
import { IllegalActionError } from "./errors.ts";
import { proceed } from "./income.ts";
import { fundedCards, monumentCost } from "./monuments.ts";
import { canRecruitIn, combinations, handCardsInDistrict, handLikeCards, printedDistrict, takeHandLike } from "./main.ts";
import { construct, laneEntryTriggers, proposePolicy, recruit, seatSenator } from "./plays.ts";
import type { Rng } from "./rng.ts";
import { bestReveal, policyTargets, revealPasses } from "./senate.ts";
import {
  Phase,
  type FreeActionAction,
  type GameEvent,
  type GameState,
  type PlayerId,
} from "./types.ts";
import { isEventCard, marketTakeSources } from "./world.ts";
import { otherPlayer } from "./zones.ts";

/** Architecture Inc. (2026-11-26): its district's cards are wild for its free construction. */
export const ARCHITECTURE_WILD = District.Shavvinne;

type Ability = FreeActionAction["ability"];

const ABILITY_OF: Partial<Record<string, Ability>> = {
  [EffectId.DrawToHandLimitEndActionSkipIncome]: "kybernetik",
  [EffectId.InfluenceSenateThenDraw]: "foreignInc",
  [EffectId.ReplaceAllianceUnmatched]: "centuryInc",
  [EffectId.ConstructMonumentShavvinneWild]: "architectureInc",
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
        // "Right after main action" (Joe, 2026-11-26): no longer in place of it.
        if (state.turn.mainActionDone && state.players[player].hand.length < handLimit(state, player)) {
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
        // Any available monument, paid with its district's cards and Shavvinne ones (wild): one
        // representative payment each, its own district's cards first.
        for (const monument of state.availableMonuments) {
          const district = printedDistrict(monument.cardId);
          const cost = monumentCost(state, monument.instanceId);
          const own = handCardsInDistrict(state, player, district);
          const wild = district === ARCHITECTURE_WILD ? [] : handCardsInDistrict(state, player, ARCHITECTURE_WILD);
          const pay = [...own, ...wild].slice(0, cost);
          if (pay.length < cost) continue;
          const discarded = [...pay, ...fundedCards(state, monument.instanceId)].map((card) => printedDistrict(card.cardId));
          if (martialLawBlocks(state, discarded)) continue;
          actions.push({ ...base, source, ability: "architectureInc", instanceIds: pay.map((card) => card.instanceId), monumentInstanceId: monument.instanceId });
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
        // The strongest allowed reveal.
        const cards = bestReveal(state, handLikeCards(state, player, { market: false }));
        const cardIds = cards.map((card) => card.cardId);
        if (revealPasses(state, cardIds)) {
          for (const target of policyTargets(state, cardIds, { anyDistrict: true })) {
            actions.push({
              ...base,
              source,
              ability: "capitolInc",
              revealIds: cards.map((card) => card.instanceId),
              discardId: cards[0]?.instanceId ?? null,
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
      // "Right after main action, you may draw to hand limit. If you do, end your action step and
      // skip income step this turn." Politics still happens.
      if (!state.turn.mainActionDone) throw new IllegalActionError("Kybernetik Inc. comes right after your main action");
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
      construct(state, player, action.instanceIds, action.monumentInstanceId, rng, events, { wild: ARCHITECTURE_WILD });
      break;
    case "rebelInc": {
      // Joe, 2026-11-26: "get +2 partisans if you have fewer partisans": 2 when behind before
      // recruiting, else the usual 1.
      const behind = state.players[player].partisans < state.players[otherPlayer(player)].partisans;
      recruit(state, player, action.instanceIds, events, behind ? 2 : 1);
      break;
    }
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
      proposePolicy(state, player, action.revealIds, action.discardId, action.district, action.policyId, events, { anyDistrict: true });
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
