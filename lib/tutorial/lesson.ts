/**
 * What a lesson is made of: a position, the coach's steps, and the opponent's script.
 * Pure data plus the matcher that compares a move with what a step asks for.
 */
import type { ExpansionVictoryId } from "../cards/expansion.ts";
import { getCard } from "../cards/catalog.ts";
import type { DecreeIdValue, DistrictId, MonumentIdValue, PolicyIdValue } from "../cards/schema.ts";
import type { AiLevel } from "../game/ai.ts";
import type { Action, EventUse, FreeActionAction, VictoryKindId } from "../game/types.ts";
import type { CastId } from "./cast.ts";
import type { ScenarioSpec } from "./scenario.ts";

/**
 * A move a step asks for (or the opponent's script plays). Unset fields match anything:
 * `{ type: "takeMarket" }` is any Market card.
 */
export type Expect =
  | { type: "playCivil" | "playAlliance" | "playConspiracy" | "influenceSenate" | "takeMarket"; card?: string }
  | { type: "recruit"; district?: DistrictId }
  | { type: "construct"; monument?: MonumentIdValue }
  | { type: "proposePolicy"; district?: DistrictId; policy?: PolicyIdValue | null }
  | { type: "declareVictory"; victory?: VictoryKindId }
  | { type: "activateDecree"; decree?: DecreeIdValue }
  | { type: "buyEvent"; event?: string; use?: EventUse; victory?: ExpansionVictoryId }
  /** A free action; `card` is the card it takes (East events), `district` the cards it spends (Rebel Inc.). */
  | { type: "freeAction"; ability?: FreeActionAction["ability"]; card?: string; district?: DistrictId }
  | { type: "endAction" | "endPolitics" | "passIncome" }
  /** Setup, in a lesson that plays a whole game. */
  | { type: "chooseParty" | "chooseStartingHand" };

/** One of the opponent's moves, and what they say while making it. */
export type ScriptedMove = Expect & { say?: string };

/**
 * Where the coach points: a `data-tour` anchor on the table ("senate", "your-hand", …), or
 * `lane:<district>` for one district's column.
 */
export type CoachTarget = string;

type StepBase = {
  title: string;
  body: string;
  target?: CoachTarget;
  /** Phone layout: the half of the table this step is about. */
  view?: "districts" | "table";
  /**
   * Show this step right away, even when the opponent moves next (the opponent waits until
   * it's read). Without it, a step waits for the learner's next decision.
   */
  now?: boolean;
};

/** Read, then press Next. No move is allowed meanwhile. */
export type ExplainStep = StepBase & { kind: "explain" };

/**
 * Where the learner is in a move that takes several clicks, as the table reports it:
 * a card picked and waiting for its district, a Senate seat ready, cards being picked to
 * recruit or build, the parts of a proposal, an event being bought.
 */
export type MoveStage =
  | "idle"
  | "play-selected"
  | "seat-armed"
  | "recruit"
  | "recruit-ready"
  | "construct"
  | "construct-ready"
  | "propose-reveal"
  | "propose-passing"
  | "propose-choosing"
  | "propose-discard"
  | "buying";

/** What the coach says (and points at) for one part of a several-click move. */
export type StageNote = { body: string; target?: CoachTarget };

/**
 * Make one particular move; anything else gets `hint`. `stages` replace the body (and the
 * spotlight) while the move is part-way done, so the note always says what to click next.
 */
export type DoStep = StepBase & {
  kind: "do";
  expect: Expect;
  hint: string;
  stages?: Partial<Record<MoveStage, StageNote>>;
};

/**
 * Any legal move. Ends at the end of the learner's turn, or when someone wins.
 * `solution` is a line that finishes it (the lesson tests play it; the coach's Hint explains it).
 * A whole game has none: the tests let the computer play the learner's seat.
 */
export type FreeStep = StepBase & {
  kind: "free";
  until: "turnEnd" | "victory";
  hint?: string;
  solution?: Expect[];
};

export type LessonStep = ExplainStep | DoStep | FreeStep;

/** The tutorial's chapters: who you face, and where. */
export type ActId = "townHall" | "capital" | "palace" | "foreign";

/** A whole game from setup (choosing parties) instead of a prepared table: a new deal every attempt. */
export type NewGameSpec = { newGame: true };

export function isNewGame(scenario: ScenarioSpec | NewGameSpec): scenario is NewGameSpec {
  return "newGame" in scenario;
}

export type Lesson = {
  id: string;
  act: ActId;
  title: string;
  /** One line for the lesson list. */
  summary: string;
  /** Short tags for the lesson list ("Civil cards", "Influence", …). */
  teaches: string[];
  opponent: CastId;
  /** Played with Legacy & Diplomacy. */
  expansion?: boolean;
  /** The opponent's greeting, and their lines when you finish or when they win. */
  intro: string;
  outro: string;
  lose?: string;
  /** Table areas (`data-tour` anchors) dimmed in this lesson: not introduced yet. */
  dim?: string[];
  /** Table areas left off the screen altogether (Town Hall: everything politics). */
  hide?: string[];
  /** No Politics step: it passes by itself for both players, and the turn panel doesn't show it. */
  skipPolitics?: boolean;
  /** The opponent's strength once their script runs out, if not their usual one. */
  opponentLevel?: AiLevel;
  scenario: ScenarioSpec | NewGameSpec;
  steps: LessonStep[];
  /** The opponent's moves, in order. Once spent (or if one can't be played), the computer plays. */
  script: ScriptedMove[];
};

function sameCard(instanceId: string, cardId: string | undefined): boolean {
  return cardId === undefined || instanceId === cardId || instanceId === `ev-${cardId}`;
}

function districtOf(instanceId: string): DistrictId | null {
  const def = getCard(instanceId);
  return "district" in def ? def.district : null;
}

/** Does `action` fit what `expect` asks for? */
export function matches(expect: Expect, action: Action): boolean {
  if (expect.type !== action.type) return false;
  switch (action.type) {
    case "playCivil":
    case "playAlliance":
    case "playConspiracy":
    case "influenceSenate":
    case "takeMarket":
      return sameCard(action.instanceId, "card" in expect ? expect.card : undefined);
    case "recruit": {
      const district = expect.type === "recruit" ? expect.district : undefined;
      return district === undefined || action.instanceIds.every((id) => districtOf(id) === district);
    }
    case "construct": {
      const monument = expect.type === "construct" ? expect.monument : undefined;
      return monument === undefined || action.monumentInstanceId === monument;
    }
    case "proposePolicy": {
      if (expect.type !== "proposePolicy") return false;
      if (expect.district !== undefined && action.district !== expect.district) return false;
      return expect.policy === undefined || action.policyId === expect.policy;
    }
    case "declareVictory":
      return expect.type !== "declareVictory" || expect.victory === undefined || action.victory.kind === expect.victory;
    case "activateDecree":
      return expect.type !== "activateDecree" || expect.decree === undefined || action.decreeId === expect.decree;
    case "buyEvent": {
      if (expect.type !== "buyEvent") return false;
      if (!sameCard(action.instanceId, expect.event)) return false;
      if (expect.use !== undefined && action.use !== expect.use) return false;
      return expect.victory === undefined || action.victory === expect.victory;
    }
    case "freeAction": {
      if (expect.type !== "freeAction") return false;
      if (expect.ability !== undefined && action.ability !== expect.ability) return false;
      if (expect.district !== undefined && !("instanceIds" in action && action.instanceIds.every((id) => districtOf(id) === expect.district))) {
        return false;
      }
      return expect.card === undefined || ("instanceId" in action && sameCard(action.instanceId, expect.card));
    }
    default:
      return true;
  }
}
