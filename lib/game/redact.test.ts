/** Online play: a seat's view never contains the other seat's hidden cards, and stays playable. */
import { currentActor, legalActions } from "./engine.ts";
import { newReplay, stepReplay, type Replay } from "./record.ts";
import { HIDDEN_CARD_ID, redactEvents, redactState } from "./redact.ts";
import { createSeededRng } from "./rng.ts";
import type { CardInstance, GameState, PlayerId } from "./types.ts";
import { assert, report } from "./test-helpers.ts";

/** Instance ids `seat` must not learn: the opponent's face-down hand, the deck, hidden piles. */
function secretIds(state: GameState, seat: PlayerId): string[] {
  const other: PlayerId = seat === 0 ? 1 : 0;
  const intel = state.pending.find((choice) => choice.kind === "intelNetwork" && choice.player === seat);
  const shown = new Set(intel && intel.kind === "intelNetwork" ? intel.instanceIds : []);
  const ids = (cards: readonly CardInstance[]) => cards.map((card) => card.instanceId);
  return [
    ...ids(state.players[other].hand.filter((card) => !card.faceUp)),
    ...ids(state.deck.filter((card) => !shown.has(card.instanceId))),
    ...ids(state.monumentDeck),
    ...(state.expansion ? [...ids(state.expansion.eventDeck), ...ids(state.expansion.box)] : []),
    ...(state.setup ? ids(state.setup.startingOffers[other]) : []),
  ];
}

/** True if `id` appears as a whole JSON string value (not as part of another id). */
function mentions(json: string, id: string): boolean {
  return json.includes(`"${id}"`);
}

function play(seed: number, expansion: boolean, steps: number, check: (replay: Replay) => void): void {
  const chooser = createSeededRng(seed * 31 + 7);
  let replay = newReplay(seed, { expansion, foreignInfluence: expansion });
  check(replay);
  for (let i = 0; i < steps && !replay.state.victory; i++) {
    const options = legalActions(replay.state, currentActor(replay.state));
    const busy = options.filter((a) => a.type !== "endAction" && a.type !== "endPolitics");
    const pool = busy.length > 0 && chooser.nextInt(4) > 0 ? busy : options;
    replay = stepReplay(replay, pool[chooser.nextInt(pool.length)]!);
    check(replay);
  }
}

let checked = 0;
for (const [seed, expansion] of [[3, false], [8, false], [13, true], [21, true]] as const) {
  play(seed, expansion, 260, (replay) => {
    const { state } = replay;
    const events = replay.steps.flatMap((step) => step.events);
    for (const seat of [0, 1] as const) {
      const view = redactState(state, seat);
      const viewJson = JSON.stringify(view);
      const eventsJson = JSON.stringify(redactEvents(events, seat));
      assert(view.seed === 0, "The seed is never sent");
      for (const id of secretIds(state, seat)) {
        // The placeholder's own card id is a General Election id; it reveals nothing.
        if (id === HIDDEN_CARD_ID) continue;
        assert(!mentions(viewJson, id), `Seat ${seat} view leaks ${id} (seed ${seed}, step ${replay.steps.length})`);
      }
      // Events: the opponent's drawn cards and secret setup picks never appear.
      const other = seat === 0 ? 1 : 0;
      for (const event of replay.steps.flatMap((step) => step.events)) {
        if (event.type === "cardDrawn" && event.player === other) {
          const stillHidden = state.players[other].hand.some((card) => card.cardId === event.cardId && !card.faceUp);
          if (stillHidden) assert(!eventsJson.includes(`"cardDrawn","player":${other},"cardId":"${event.cardId}"`), "Opponent draws are hidden");
        }
      }
      // The seat's own options are unchanged, so the client can drive the UI from the view.
      if (currentActor(state) === seat) {
        const full = JSON.stringify(legalActions(state, seat));
        const redacted = JSON.stringify(legalActions(view, seat));
        assert(full === redacted, `Seat ${seat} legal actions differ on the view (seed ${seed}, step ${replay.steps.length})`);
      }
      checked += 1;
    }
  });
}
assert(checked > 500, `Checked enough views (${checked})`);

// Setup: the opponent's dealt and chosen parties stay secret.
{
  let replay = newReplay(5);
  replay = stepReplay(replay, legalActions(replay.state, 0)[0]!);
  const view = redactState(replay.state, 1);
  assert(view.setup!.chosenParty[0] === null && view.setup!.dealtParties[0].length === 0, "Opponent's party pick is secret");
  const events = redactEvents(replay.steps.flatMap((step) => step.events), 1);
  assert(!events.some((event) => event.type === "partyChosen"), "partyChosen is dropped for the other seat");
  assert(redactState(replay.state, 0).setup!.chosenParty[0] !== null, "You see your own pick");
  assert(HIDDEN_CARD_ID.length > 0, "placeholder id");
}

report("Redaction ok: hidden hands, deck, piles, setup picks, and seed stay private; legal actions unchanged on the view.");
