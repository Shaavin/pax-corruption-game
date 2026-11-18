/**
 * Decode a player's bug report (or any game record) and print what an
 * investigator needs: report metadata, version warnings, replay failures,
 * invariant issues, the moves around the reported step with their events,
 * the board at that step, and the legal actions there.
 *
 * Usage:
 *   node --experimental-strip-types --no-warnings scripts/inspect-report.ts <report.json | PAX1:code | -> [options]
 *
 * Options:
 *   --step N     Inspect after N actions (default: the report's stepCount, else the last step)
 *   --around N   Moves to list on each side of the step (default 8; "all" for every move)
 *   --state      Also print the full raw state at the step as JSON
 *   --record     Print the decoded record as JSON (to paste into a test) and exit
 */
import { existsSync, readFileSync } from "node:fs";
import { getCard } from "../lib/cards/catalog.ts";
import { describeAction, simulate } from "../lib/game/diagnostics.ts";
import { currentActor, legalActions } from "../lib/game/engine.ts";
import { ENGINE_VERSION, parseImport } from "../lib/game/record.ts";
import type { CardInstance, GameState } from "../lib/game/types.ts";

function usage(message?: string): never {
  if (message) console.error(`Error: ${message}\n`);
  console.error("Usage: scripts/inspect-report.ts <report.json | PAX1:code | -> [--step N] [--around N|all] [--state] [--record]");
  process.exit(1);
}

const args = process.argv.slice(2);
let source: string | null = null;
let stepOption: number | null = null;
let around = 8;
let showState = false;
let showRecord = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  if (arg === "--step") stepOption = Number(args[++i]);
  else if (arg === "--around") {
    const value = args[++i];
    around = value === "all" ? Number.POSITIVE_INFINITY : Number(value);
  } else if (arg === "--state") showState = true;
  else if (arg === "--record") showRecord = true;
  else if (source === null) source = arg;
  else usage(`unexpected argument ${arg}`);
}
if (source === null) usage();
if (stepOption !== null && !Number.isInteger(stepOption)) usage("--step needs a whole number");
if (!Number.isFinite(around) && around !== Number.POSITIVE_INFINITY) usage("--around needs a number or 'all'");

let text: string;
if (source === "-") text = readFileSync(0, "utf8");
else if (source.trim().startsWith("PAX1:")) text = source;
else if (existsSync(source)) text = readFileSync(source, "utf8");
else usage(`${source} is not a file, a PAX1: code, or -`);

const imported = parseImport(text);
if (!imported) usage("could not read a bug report, record, or share code from the input");
const { record, report } = imported;

if (showRecord) {
  console.log(JSON.stringify(record, null, 2));
  process.exit(0);
}

const sim = simulate(record);
const lastIndex = sim.states.length - 1;
const requested = stepOption ?? report?.stepCount ?? lastIndex;
const step = Math.max(0, Math.min(requested, lastIndex));

const name = (card: CardInstance) => {
  try {
    return getCard(card.cardId).name;
  } catch {
    return card.cardId;
  }
};
const names = (cards: CardInstance[]) => (cards.length === 0 ? "—" : cards.map(name).join(", "));
const section = (title: string) => console.log(`\n## ${title}`);

section("Report");
if (report) {
  console.log(`Description: ${report.description || "(none)"}`);
  console.log(`Created: ${report.createdAt}`);
  console.log(`Viewer seat: ${report.viewer === null ? "none" : `P${report.viewer + 1}`}`);
  console.log(`Reported at step: ${report.stepCount} of ${record.actions.length}`);
  if (report.userAgent) console.log(`User agent: ${report.userAgent}`);
} else {
  console.log("(plain game record, no report metadata)");
}
console.log(`Seed: ${record.seed} · Mode: ${record.mode ?? "standard"} · Expansion: ${record.expansion ? `yes${record.foreignInfluence ? " (Foreign Influence)" : ""}` : "no"}`);
console.log(`Recorded engine: ${record.engineVersion ?? "(none)"} · This engine: ${ENGINE_VERSION} · Build: ${record.build ?? "(unknown)"}`);
if (record.ai) console.log(`Computer opponent: ${JSON.stringify(record.ai)}`);
if (record.names) console.log(`Names: ${JSON.stringify(record.names)}`);

section("Replay health");
if (sim.versionWarning) console.log(`VERSION WARNING: ${sim.versionWarning}`);
if (sim.failure) {
  console.log(`FAILURE at action ${sim.failure.index + 1}: ${sim.failure.message}`);
  console.log(`  Action: ${JSON.stringify(sim.failure.action)}`);
} else {
  console.log(`All ${record.actions.length} actions replayed.`);
}
if (sim.issues.length === 0) console.log("No invariant issues.");
for (const found of sim.issues) console.log(`INVARIANT after step ${found.stateIndex}: ${found.issues.join("; ")}`);
if (step !== requested) console.log(`Note: step ${requested} is past the replayable end; showing step ${step}.`);

section(`Moves around step ${step}`);
const from = Math.max(0, step - around);
const to = Math.min(sim.steps.length, step + around);
for (let i = from; i < to; i++) {
  const marker = i + 1 === step ? "  <-- reported step" : "";
  console.log(`${String(i + 1).padStart(4)}. ${describeAction(sim.steps[i]!.action, sim.states[i]!)}${sim.steps[i]!.undoable ? "" : " [no undo]"}${marker}`);
  for (const event of sim.steps[i]!.events) console.log(`        · ${JSON.stringify(event)}`);
}
if (sim.failure && sim.failure.index >= from && sim.failure.index <= to) {
  console.log(`${String(sim.failure.index + 1).padStart(4)}. FAILED: ${describeAction(sim.failure.action, sim.states[sim.failure.index]!)} — ${sim.failure.message}`);
}

const state: GameState = sim.states[step]!;
section(`Board after step ${step}`);
console.log(`Phase: ${state.phase} · Active: P${state.activePlayer + 1} · Turn: ${JSON.stringify(state.turn)}`);
console.log(`Districts: ${state.districtOrder.join(", ")}`);
console.log(`Policy: ${JSON.stringify(state.policy)}`);
console.log(`Senate: ${names(state.senate)}`);
console.log(`Market (${state.market.length}): ${names(state.market)}`);
console.log(`Deck: ${state.deck.length} cards · Top: ${state.deck[0] ? name(state.deck[0]) : "—"}`);
console.log(`Monuments available: ${names(state.availableMonuments)}`);
if (state.decrees.length > 0) console.log(`Decrees: ${JSON.stringify(state.decrees)}`);
if (state.pending.length > 0) console.log(`Pending choices: ${JSON.stringify(state.pending)}`);
if (state.pendingDecrees) console.log(`Pending decrees: ${JSON.stringify(state.pendingDecrees)}`);
if (state.resume) console.log(`Resume: ${JSON.stringify(state.resume)}`);
if (Object.keys(state.flags).length > 0) console.log(`Flags: ${JSON.stringify(state.flags)}`);
if (state.victory) console.log(`Victory: ${JSON.stringify(state.victory)}`);
state.players.forEach((player, seat) => {
  console.log(`\nP${seat + 1} · party ${player.partyId ?? "—"} · partisans ${player.partisans} · hand limit ${player.handLimit} · election wins ${player.electionWins}`);
  console.log(`  Hand: ${names(player.hand)}`);
  for (const district of state.districtOrder) {
    const tableau = player.tableau[district] ?? [];
    const support = player.support[district] ?? [];
    if (tableau.length + support.length > 0) console.log(`  ${district}: ${names(tableau)} | support: ${names(support)}`);
  }
  if (player.monuments.length > 0) console.log(`  Monuments: ${names(player.monuments)}`);
  if (player.consultativeOffice.length > 0) console.log(`  Consultative Office: ${names(player.consultativeOffice)}`);
  if (player.planetNextBank.length > 0) console.log(`  Planet Next bank: ${names(player.planetNextBank)}`);
});
if (state.expansion) console.log(`\nExpansion: ${JSON.stringify(state.expansion)}`);

section(`Legal actions at step ${step}`);
if (state.victory) {
  console.log("(game over)");
} else {
  const actor = currentActor(state);
  const legal = legalActions(state, actor);
  console.log(`P${actor + 1} to act · ${legal.length} legal action(s)`);
  for (const action of legal) console.log(`  - ${describeAction(action, state)}`);
}

if (showState) {
  section(`Raw state after step ${step}`);
  console.log(JSON.stringify(state, null, 2));
}
