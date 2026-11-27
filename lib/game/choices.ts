/**
 * Pending choices raised by abilities (Currency Ballots, Urban Aristocrats,
 * Intel Network, People's Press, Space Academy). The front of the queue must be
 * resolved before anything else happens; then the turn resumes.
 */
import { getCard } from "../cards/catalog.ts";
import { CardKind, District, type DistrictId } from "../cards/schema.ts";
import { unitedFrontRedirect } from "./abilities.ts";
import { discardAlliances, discardOwn } from "./discard.ts";
import { drawToHand } from "./draw.ts";
import { IllegalActionError } from "./errors.ts";
import { resumeAfterChoice } from "./income.ts";
import { handLikeCards, printedDistrict, takeHandLike } from "./main.ts";
import { swapCandidates, swapPairs, swapProblem } from "./plays.ts";
import type { Action, GameEvent, GameState, PendingChoice, PlayerId } from "./types.ts";
import { otherPlayer } from "./zones.ts";

export function currentChoice(state: GameState): PendingChoice | null {
  return state.pending[0] ?? null;
}

/** Legal answers to the front choice (representative for route choices). */
export function choiceActions(state: GameState, viewer: PlayerId): Action[] {
  const choice = currentChoice(state);
  if (!choice || choice.player !== viewer) return [];
  switch (choice.kind) {
    case "discardOne":
      return handLikeCards(state, viewer, { market: false }).map((card) => ({
        type: "chooseDiscard" as const,
        player: viewer,
        instanceId: card.instanceId,
      }));
    case "swapCivils":
      return [
        { type: "chooseSwap" as const, player: viewer, swap: null },
        ...swapPairs(state, viewer).map(([a, b]) => ({
          type: "chooseSwap" as const,
          player: viewer,
          swap: { mine: a.instanceId, theirs: b.instanceId },
        })),
      ];
    case "intelNetwork":
      return choice.instanceIds.map((instanceId) => ({ type: "chooseIntel" as const, player: viewer, instanceId }));
    case "peoplesPress":
      return [
        { type: "choosePress" as const, player: viewer, instanceId: null },
        ...state.players[viewer].support[District.Smarbbit].map((card) => ({
          type: "choosePress" as const,
          player: viewer,
          instanceId: card.instanceId,
        })),
      ];
    case "routeDiscards":
      return [{ type: "routeDiscards" as const, player: viewer, moves: [] }];
    case "trimAlliances":
      return combinations(laneAlliances(state, viewer, choice.district).map((card) => card.instanceId), choice.count).map(
        (instanceIds) => ({ type: "trimAlliances" as const, player: viewer, instanceIds }),
      );
  }
}

function requireChoice<K extends PendingChoice["kind"]>(
  state: GameState,
  player: PlayerId,
  kind: K,
): Extract<PendingChoice, { kind: K }> {
  const choice = currentChoice(state);
  if (!choice || choice.kind !== kind || choice.player !== player) {
    throw new IllegalActionError("That choice isn't pending");
  }
  state.pending.shift();
  return choice as Extract<PendingChoice, { kind: K }>;
}

/** Currency Ballots: discard one card from hand. */
export function chooseDiscard(state: GameState, player: PlayerId, instanceId: string, events: GameEvent[]): void {
  requireChoice(state, player, "discardOne");
  const card = takeHandLike(state, player, instanceId, { market: false });
  discardOwn(state, player, [card], events);
  resumeAfterChoice(state, events);
}

/** Urban Aristocrats: swap one of your played Dragonara cards with one of theirs (they change owners). */
export function chooseSwap(
  state: GameState,
  player: PlayerId,
  swap: { mine: string; theirs: string } | null,
  events: GameEvent[],
): void {
  requireChoice(state, player, "swapCivils");
  if (swap) {
    const { mine, theirs } = swapCandidates(state, player);
    const a = mine.find((card) => card.instanceId === swap.mine);
    const b = theirs.find((card) => card.instanceId === swap.theirs);
    if (!a || !b) throw new IllegalActionError("Pick one of your played Dragonara cards and one of theirs");
    const problem = swapProblem(state, player, a, b);
    if (problem) throw new IllegalActionError(problem);
    const opponent = otherPlayer(player);
    const lane = District.Dragonara;
    state.players[player].tableau[lane] = state.players[player].tableau[lane].filter((card) => card !== a);
    state.players[opponent].tableau[lane] = state.players[opponent].tableau[lane].filter((card) => card !== b);
    state.players[player].tableau[lane].push(b);
    state.players[opponent].tableau[lane].push(a);
    events.push({ type: "civilsSwapped", player, mineCardId: a.cardId, theirsCardId: b.cardId });
  }
  resumeAfterChoice(state, events);
}

/** Intel Network: move one of the inspected cards to the top of the deck. */
export function chooseIntel(state: GameState, player: PlayerId, instanceId: string, events: GameEvent[]): void {
  const choice = requireChoice(state, player, "intelNetwork");
  if (!choice.instanceIds.includes(instanceId)) throw new IllegalActionError("Pick one of the inspected cards");
  const index = state.deck.findIndex((card) => card.instanceId === instanceId);
  if (index < 0) throw new IllegalActionError("That card is no longer in the deck");
  const [card] = state.deck.splice(index, 1);
  state.deck.unshift(card!);
  events.push({ type: "deckReordered", player });
  resumeAfterChoice(state, events);
}

/** People's Press: draw from the deck (`null`) or take a card from your Smarbbit support pile. */
export function choosePress(state: GameState, player: PlayerId, instanceId: string | null, events: GameEvent[]): void {
  requireChoice(state, player, "peoplesPress");
  if (instanceId === null) {
    drawToHand(state, player, events);
  } else {
    const pile = state.players[player].support[District.Smarbbit];
    const index = pile.findIndex((card) => card.instanceId === instanceId);
    if (index < 0) throw new IllegalActionError("That card isn't in your Smarbbit support pile");
    const [card] = pile.splice(index, 1);
    state.players[player].hand.push({ ...card!, faceUp: true, occupiedDistrict: undefined });
    events.push({ type: "cardRetrieved", player, cardId: card!.cardId, district: District.Smarbbit });
  }
  resumeAfterChoice(state, events);
}

/**
 * Space Academy (was Space Agency; card updated 2026-11-18): "You may discard up
 * to 1 of the cards to another support pile each time you discard." At most one
 * of the just-discarded cards moves, to another of your piles.
 */
export function routeDiscards(
  state: GameState,
  player: PlayerId,
  moves: { instanceId: string; district: DistrictId }[],
  events: GameEvent[],
): void {
  const choice = requireChoice(state, player, "routeDiscards");
  if (moves.length > 1) {
    throw new IllegalActionError("Space Academy moves at most one card each time you discard");
  }
  const moved: { cardId: string; district: DistrictId }[] = [];
  for (const move of moves) {
    if (!choice.instanceIds.includes(move.instanceId)) {
      throw new IllegalActionError("Only the cards you just discarded can be moved");
    }
    const found = findInPiles(state, move.instanceId);
    if (!found) throw new IllegalActionError("That card is no longer in a support pile");
    if (found.district === move.district) throw new IllegalActionError("Move it to a different pile");
    const pile = state.players[found.owner].support[found.district];
    const [card] = pile.splice(pile.indexOf(found.card), 1);
    // A card sent into Smarbbit under United Front still lands with the opponent.
    const owner = unitedFrontRedirect(state, move.district) ? otherPlayer(player) : player;
    state.players[owner].support[move.district].push({ ...card!, occupiedDistrict: move.district });
    moved.push({ cardId: card!.cardId, district: move.district });
  }
  if (moved.length > 0) events.push({ type: "discardsRouted", player, moves: moved });
  resumeAfterChoice(state, events);
}

function findInPiles(state: GameState, instanceId: string) {
  for (const owner of [0, 1] as const) {
    for (const district of state.districtOrder) {
      const card = state.players[owner].support[district].find((entry) => entry.instanceId === instanceId);
      if (card) return { owner, district, card };
    }
  }
  return null;
}

function laneAlliances(state: GameState, player: PlayerId, district: DistrictId) {
  return state.players[player].tableau[district].filter((card) => getCard(card.cardId).kind === CardKind.Alliance);
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  return items.flatMap((item, index) =>
    combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]),
  );
}

/** Alliance limit lowered (Martial Law): the owner picks which alliances to discard. */
export function trimAlliances(state: GameState, player: PlayerId, instanceIds: string[], events: GameEvent[]): void {
  const choice = requireChoice(state, player, "trimAlliances");
  const ids = new Set(instanceIds);
  const lane = laneAlliances(state, player, choice.district);
  const cards = lane.filter((card) => ids.has(card.instanceId));
  if (ids.size !== instanceIds.length || cards.length !== ids.size) {
    throw new IllegalActionError("Pick alliances from that district's lane");
  }
  if (cards.length !== choice.count) {
    throw new IllegalActionError(`Discard exactly ${choice.count} ${choice.count === 1 ? "alliance" : "alliances"}`);
  }
  discardAlliances(state, player, choice.district, cards, events);
  resumeAfterChoice(state, events);
}

/** Printed district of a card in a route choice (for UI hints). */
export function routeOrigin(cardId: string): DistrictId {
  return printedDistrict(getCard(cardId).id);
}
