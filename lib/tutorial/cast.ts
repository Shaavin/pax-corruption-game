/**
 * The tutorial's opponents: the three computer personalities, met in order of skill.
 * Names, portraits, and colors come from the computer opponent itself (`ai.ts`), so the
 * lessons and the "vs Computer" games share one cast.
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
  /** Their portrait (an image path) and its ring color. */
  portrait: string;
  color: string;
};

function member(id: CastId, level: AiLevel, role: string): CastMember {
  const persona = aiPersona(level);
  return { id, level, name: persona.name, role, portrait: persona.portrait, color: persona.color };
}

export const CAST: Record<CastId, CastMember> = {
  mildred: member("mildred", "easy", "Mayor of Town Hall"),
  crane: member("crane", "normal", "Chancellor of the Capital"),
  vex: member("vex", "hard", "retired Grand Vizier of the Old Palace"),
};
