import { buildActionLog } from "./action-log.ts";
import { apply, legalActions } from "./engine.ts";
import type { GameEvent } from "./types.ts";
import { assert, playToTurnOne, report } from "./test-helpers.ts";

// Play a few plain turns and collect every event.
{
  const { state: start, rng } = playToTurnOne(301);
  let state = start;
  const events: GameEvent[] = [];
  for (let turn = 0; turn < 6 && state.phase !== "gameOver"; turn++) {
    const actor = state.activePlayer;
    const main = legalActions(state, actor);
    const action = main.find((entry) => entry.type === "playCivil") ?? main[0]!;
    let result = apply(state, action, rng);
    events.push(...result.events);
    state = result.state;
    if (state.phase === "politics") {
      result = apply(state, { type: "endPolitics", player: actor }, rng);
      events.push(...result.events);
      state = result.state;
    }
    if (state.phase === "income") {
      result = apply(state, { type: "takeMarket", player: actor, instanceId: state.market[0]!.instanceId }, rng);
      events.push(...result.events);
      state = result.state;
    }
  }

  const log = buildActionLog(events, 0);
  assert(log.length > 0, "Turns produce log entries");
  assert(log.some((entry) => entry.kind === "play"), "Plays are logged");
  assert(log.some((entry) => entry.kind === "market"), "Market takes are logged");

  // Deck draws are hidden information: no entry may name a drawn card.
  const drawn = new Set(
    events.flatMap((event) => (event.type === "cardDrawn" ? [event.cardId] : [])),
  );
  const visible = new Set(
    events.flatMap((event) =>
      event.type === "civilPlayed" || event.type === "alliancePlayed" || event.type === "conspiracyPlayed"
        ? [event.cardId]
        : [],
    ),
  );
  for (const entry of log) {
    const cards = [entry.primary, ...entry.related].filter((card) => card !== null);
    for (const card of cards) {
      assert(
        !drawn.has(card.cardId) || visible.has(card.cardId),
        `Log entry "${entry.summary}" shows a card that was only drawn`,
      );
    }
  }
}

report("Action log ok: plays and market takes logged; deck draws stay hidden.");
