import { getCard } from "../cards/catalog.ts";
import { apply } from "./engine.ts";
import { ENGINE_VERSION, newReplay, undoBlockReason, type GameRecord, type ReplayStep } from "./record.ts";
import { Phase, type Action, type CardInstance, type GameState } from "./types.ts";

/**
 * Troubleshooting: rebuild a recorded game step by step, keeping every
 * intermediate state, and report the first action that fails plus any engine
 * invariant that breaks along the way.
 */

export type StepIssue = {
  /** Index into `Simulation.states` (0 = before the first action). */
  stateIndex: number;
  issues: string[];
};

export type Simulation = {
  record: GameRecord;
  /** `states[0]` is the new game; `states[i + 1]` follows `record.actions[i]`. */
  states: GameState[];
  steps: ReplayStep[];
  /** The first action that could not be applied. Later actions are not replayed. */
  failure: { index: number; action: Action; message: string } | null;
  issues: StepIssue[];
  /** Set when the record was made by a different engine version. */
  versionWarning: string | null;
};

export function simulate(record: GameRecord): Simulation {
  const replay = newReplay(record.seed, record.mode);
  const states: GameState[] = [replay.state];
  const steps: ReplayStep[] = [];
  const issues: StepIssue[] = [];
  let failure: Simulation["failure"] = null;
  let baseline: number | null = null;

  const check = (state: GameState, stateIndex: number) => {
    const found = invariantIssues(state, baseline);
    if (baseline === null && state.setup === null) baseline = countCards(state);
    if (found.length > 0) issues.push({ stateIndex, issues: found });
  };
  check(replay.state, 0);

  let state = replay.state;
  for (let index = 0; index < record.actions.length; index++) {
    const action = record.actions[index]!;
    try {
      const result = apply(state, action, replay.rng);
      const undoable = undoBlockReason(state, action, result.events, result.state) === null;
      steps.push({ action, events: result.events, undoable });
      state = result.state;
      states.push(state);
      check(state, states.length - 1);
    } catch (error) {
      failure = { index, action, message: error instanceof Error ? error.message : String(error) };
      break;
    }
  }

  return {
    record,
    states,
    steps,
    failure,
    issues,
    versionWarning:
      record.engineVersion && record.engineVersion !== ENGINE_VERSION
        ? `Recorded with engine ${record.engineVersion}; this build is ${ENGINE_VERSION}. Rules changes in between can make the replay differ from what the player saw.`
        : record.engineVersion
          ? null
          : `This record has no engine version. It may come from an older build.`,
  };
}

/** Every card instance outside the setup scratch area (which holds copies). */
export function allCards(state: GameState): CardInstance[] {
  const cards: CardInstance[] = [];
  const visit = (value: unknown, key: string) => {
    if (key === "setup" || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, "");
      return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.instanceId === "string" && typeof record.cardId === "string") {
      cards.push(record as unknown as CardInstance);
      return;
    }
    for (const [childKey, child] of Object.entries(record)) visit(child, childKey);
  };
  visit(state, "");
  return cards;
}

function countCards(state: GameState): number {
  return allCards(state).length;
}

/** Engine invariants. `baseline` is the card count once setup finished. */
export function invariantIssues(state: GameState, baseline: number | null): string[] {
  const issues: string[] = [];
  const cards = allCards(state);

  const seen = new Map<string, number>();
  for (const card of cards) seen.set(card.instanceId, (seen.get(card.instanceId) ?? 0) + 1);
  const duplicates = [...seen].filter(([, count]) => count > 1).map(([id]) => id);
  if (duplicates.length > 0) {
    issues.push(`Card instances in two places at once: ${duplicates.slice(0, 5).join(", ")}${duplicates.length > 5 ? "…" : ""}`);
  }

  if (state.setup === null && baseline !== null && cards.length !== baseline) {
    issues.push(`Card count changed: ${cards.length}, expected ${baseline} (a card was lost or created)`);
  }

  if (state.phase !== Phase.Setup) {
    if (state.senate.length !== 5) issues.push(`Senate holds ${state.senate.length} cards, expected 5`);
    if (state.market.length > 8) issues.push(`Market holds ${state.market.length} cards, more than 8`);
  }
  state.players.forEach((player, seat) => {
    if (player.partisans < 0) issues.push(`Player ${seat + 1} has ${player.partisans} partisans`);
  });
  if (state.victory && state.phase !== Phase.GameOver) {
    issues.push(`A victory is set but the phase is ${state.phase}`);
  }
  return issues;
}

/** Card names by instance id, including the setup offers. */
function instanceNames(state: GameState): Map<string, string> {
  const names = new Map<string, string>();
  const visit = (value: unknown) => {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.instanceId === "string" && typeof record.cardId === "string") {
      names.set(record.instanceId, cardName(record.cardId));
      return;
    }
    for (const child of Object.values(record)) visit(child);
  };
  visit(state);
  return names;
}

function cardName(cardId: string): string {
  try {
    return getCard(cardId).name;
  } catch {
    return cardId;
  }
}

function humanize(type: string): string {
  const words = type.replace(/([A-Z])/g, " $1").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function describeValue(key: string, value: unknown, names: Map<string, string>): string {
  if (typeof value === "string") {
    if (names.has(value)) return names.get(value)!;
    if (key.endsWith("Id") || key === "partyId" || key === "policyId") return cardName(value);
    return value;
  }
  if (Array.isArray(value)) return `[${value.map((entry) => describeValue(key, entry, names)).join(", ")}]`;
  if (value && typeof value === "object") {
    return `{ ${Object.entries(value)
      .map(([childKey, child]) => `${childKey}: ${describeValue(childKey, child, names)}`)
      .join(", ")} }`;
  }
  return String(value);
}

/** `monumentInstanceId` → `monument`; the main card field needs no label. */
function keyLabel(key: string): string {
  if (key === "instanceId" || key === "instanceIds" || key === "partyId") return "";
  return key.replace(/(Instance)?Ids?$/, "");
}

/** One line for the troubleshooting step list, with card names resolved from the state before the action. */
export function describeAction(action: Action, before: GameState): string {
  const names = instanceNames(before);
  const parts = Object.entries(action)
    .filter(([key]) => key !== "type" && key !== "player")
    .map(([key, value]) => {
      const label = keyLabel(key);
      const text = describeValue(key, value, names);
      return label ? `${label} ${text}` : text;
    });
  return `P${action.player + 1} · ${humanize(action.type)}${parts.length > 0 ? ` — ${parts.join("; ")}` : ""}`;
}
