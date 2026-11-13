/**
 * Online play: what one seat is allowed to see. The server keeps the full
 * state and sends each player `redactState` / `redactEvents` for their seat.
 *
 * Base cards use their card id as their instance id, so hidden cards are
 * replaced wholesale (new instance id, placeholder card id), never just renamed.
 * Face-up cards (Market takes, set-aside zones) are public and stay as they are.
 */
import type { CardInstance, GameEvent, GameState, PlayerId } from "./types.ts";

/** A real catalog id, so client code that looks cards up never throws. Always face down. */
export const HIDDEN_CARD_ID = "election-1";

function hide(cards: readonly CardInstance[], prefix: string): CardInstance[] {
  return cards.map((_, index) => ({ instanceId: `hidden-${prefix}-${index}`, cardId: HIDDEN_CARD_ID, faceUp: false }));
}

/** Hide the face-down cards in a zone, keeping public (face-up) ones. */
function hideFaceDown(cards: readonly CardInstance[], prefix: string): CardInstance[] {
  return cards.map((card, index) =>
    card.faceUp ? card : { instanceId: `hidden-${prefix}-${index}`, cardId: HIDDEN_CARD_ID, faceUp: false },
  );
}

export function redactState(state: GameState, seat: PlayerId): GameState {
  const view = structuredClone(state);
  const other: PlayerId = seat === 0 ? 1 : 0;
  // Seed + the public actions would rebuild every shuffle: never send it.
  view.seed = 0;

  // The opponent's hand: count and face-up (publicly taken) cards only.
  view.players[other].hand = hideFaceDown(view.players[other].hand, "hand");

  // Deck order is secret, except Intel Network's top cards for the player choosing.
  const intel = view.pending.find((choice) => choice.kind === "intelNetwork" && choice.player === seat);
  const shown = new Set(intel && intel.kind === "intelNetwork" ? intel.instanceIds : []);
  view.deck = view.deck.map((card, index) =>
    shown.has(card.instanceId) ? card : { instanceId: `hidden-deck-${index}`, cardId: HIDDEN_CARD_ID, faceUp: false },
  );
  view.pending = view.pending.map((choice) =>
    choice.kind === "intelNetwork" && choice.player !== seat ? { ...choice, instanceIds: [] } : choice,
  );
  view.monumentDeck = hide(view.monumentDeck, "monuments");

  // Setup: parties are dealt and chosen in secret; starting offers are private.
  if (view.setup) {
    view.setup.dealtParties[other] = [];
    view.setup.chosenParty[other] = null;
    view.setup.startingOffers[other] = hide(view.setup.startingOffers[other], "offer");
    view.setup.nonElectionPool = hide(view.setup.nonElectionPool, "pool");
    view.setup.electionCards = hide(view.setup.electionCards, "elections");
  }

  // Expansion: the event deck and the box (which includes the events removed at setup).
  if (view.expansion) {
    view.expansion.eventDeck = hide(view.expansion.eventDeck, "events");
    view.expansion.box = hide(view.expansion.box, "box");
  }
  return view;
}

/** Events with hidden details are trimmed for the seat that must not see them. */
export function redactEvents(events: readonly GameEvent[], seat: PlayerId): GameEvent[] {
  const result: GameEvent[] = [];
  for (const event of events) {
    switch (event.type) {
      case "partiesDealt":
        result.push({ ...event, dealt: { 0: seat === 0 ? event.dealt[0] : [], 1: seat === 1 ? event.dealt[1] : [] } });
        break;
      case "partyChosen":
        // Secret until both parties are revealed together.
        if (event.player === seat) result.push(event);
        break;
      case "startingHandTaken":
        result.push(event.player === seat ? event : { ...event, instanceIds: [] });
        break;
      case "cardDrawn":
        result.push(event.player === seat ? event : { ...event, cardId: HIDDEN_CARD_ID });
        break;
      case "monumentsSet":
        result.push({ ...event, deck: [] });
        break;
      default:
        result.push(event);
    }
  }
  return result;
}
