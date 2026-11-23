/**
 * The tutorial's opponents: the three computer personalities, met in order of skill.
 * Names come from the computer opponent itself (`ai.ts`), so the lessons and the
 * "vs Computer" games share one cast.
 */
import { aiPersona, type AiLevel } from "../game/ai.ts";

export type CastId = "mildred" | "crane" | "vex";

export type CastMember = {
  id: CastId;
  /** How well they play once their script runs out (and in a practice game). */
  level: AiLevel;
  name: string;
  /** Where you meet them. */
  role: string;
  /** Monogram for the portrait. */
  initials: string;
  /** Portrait color. */
  color: string;
};

function member(id: CastId, level: AiLevel, role: string, initials: string, color: string): CastMember {
  return { id, level, name: aiPersona(level).name, role, initials, color };
}

export const CAST: Record<CastId, CastMember> = {
  mildred: member("mildred", "easy", "Mayor of Town Hall", "MM", "#d9a441"),
  crane: member("crane", "normal", "Chancellor of the Capital", "CC", "#6f9fc8"),
  vex: member("vex", "hard", "retired Grand Vizier of the Old Palace", "GV", "#a66bd3"),
};
