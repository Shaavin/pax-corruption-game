/** The victory race agrees with what can actually be declared, at every step of random games. */
import { currentActor, legalActions } from "./engine.ts";
import { handCardBlockReason } from "./explain.ts";
import { victoryRace } from "./progress.ts";
import { newReplay, stepReplay } from "./record.ts";
import { createSeededRng } from "./rng.ts";
import { assert, report } from "./test-helpers.ts";
import { VictoryKind } from "./types.ts";
import { declarableVictories } from "./victory.ts";

let checked = 0;
let close = 0;
let explained = 0;
for (const [seed, expansion] of [[5, false], [9, false], [17, true], [23, true], [31, false]] as const) {
  const chooser = createSeededRng(seed * 13 + 1);
  let replay = newReplay(seed, { expansion, foreignInfluence: expansion });
  for (let i = 0; i < 400 && !replay.state.victory; i++) {
    const { state } = replay;
    if (state.phase !== "setup") {
      const race = victoryRace(state);
      for (const player of [0, 1] as const) {
        const declarable = new Set(
          declarableVictories(state, player)
            .filter((victory) => victory.kind !== VictoryKind.Civil)
            .map((victory) => victory.kind),
        );
        for (const row of race.rows) {
          const met = row.active && row.standing[player].met;
          assert(met === declarable.has(row.kind), `seed ${seed} step ${i}: ${row.kind} for P${player + 1}: race says ${met}`);
          if (row.active && row.standing[player].target - row.standing[player].value === 1) close++;
        }
      }
      assert(race.civil.electionsLeft === 4 - state.electionsOut.length, "Elections left");
      // Every hand card either has a legal play or a plain reason why not (and never both).
      if (state.phase === "action") {
        const actor = currentActor(state);
        const playable = new Set(
          legalActions(state, actor)
            .filter((action) => action.type === "playCivil" || action.type === "playAlliance" || action.type === "playConspiracy")
            .map((action) => ("instanceId" in action ? action.instanceId : "")),
        );
        for (const card of state.players[actor].hand) {
          const reason = handCardBlockReason(state, actor, card.instanceId);
          assert((reason === null) === playable.has(card.instanceId), `seed ${seed} step ${i}: ${card.cardId} reason ${reason}`);
          if (reason) explained++;
        }
      }
      checked++;
    }
    const options = legalActions(state, currentActor(state));
    const busy = options.filter((a) => a.type !== "endAction" && a.type !== "endPolitics");
    const pool = busy.length > 0 && chooser.nextInt(3) > 0 ? busy : options;
    replay = stepReplay(replay, pool[chooser.nextInt(pool.length)]!);
  }
}
assert(checked > 500, `Checked ${checked} positions`);
report(`Victory race ok: matches declarable victories at ${checked} positions (${close} one-away moments); ${explained} unplayable cards explained.`);
