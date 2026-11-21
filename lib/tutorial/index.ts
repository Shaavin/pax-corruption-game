/**
 * The tutorial ("Learn to play"): short lessons, each from a prepared position, against the
 * computer opponents in order of skill. The base game first; Legacy & Diplomacy is an
 * optional last chapter.
 */
import type { ActId, Lesson } from "./lesson.ts";
import { BASE_LESSONS } from "./lessons/base.ts";
import { EXPANSION_LESSONS } from "./lessons/expansion.ts";
import type { CastId } from "./cast.ts";

export * from "./cast.ts";
export * from "./lesson.ts";
export * from "./runner.ts";
export * from "./scenario.ts";

export type Act = {
  id: ActId;
  title: string;
  /** Where the chapter is set, and whom you face. */
  blurb: string;
  opponent: CastId;
  /** Legacy & Diplomacy: optional, after the base game. */
  expansion?: boolean;
};

export const ACTS: Act[] = [
  {
    id: "townHall",
    title: "Town Hall",
    blurb: "Your first days in office, against a mayor who means well. Mostly.",
    opponent: "mildred",
  },
  {
    id: "capital",
    title: "The Capital",
    blurb: "The Senate, the law, monuments, and election night, against a chancellor who never miscounts.",
    opponent: "crane",
  },
  {
    id: "palace",
    title: "The Palace",
    blurb: "One position, one turn, and the Grand Vizier waiting to win. Your final exam.",
    opponent: "vex",
  },
  {
    id: "foreign",
    title: "Foreign Affairs",
    blurb: "Optional: the Legacy & Diplomacy expansion. Events, World Powers, and the victories they unlock.",
    opponent: "vex",
    expansion: true,
  },
];

export const LESSONS: Lesson[] = [...BASE_LESSONS, ...EXPANSION_LESSONS];

export function getLesson(id: string | null | undefined): Lesson | null {
  return LESSONS.find((lesson) => lesson.id === id) ?? null;
}

/** The lesson after `id`, in order (the expansion chapter follows the base game). */
export function nextLesson(id: string): Lesson | null {
  const index = LESSONS.findIndex((lesson) => lesson.id === id);
  return index >= 0 ? (LESSONS[index + 1] ?? null) : null;
}

export function lessonsInAct(act: ActId): Lesson[] {
  return LESSONS.filter((lesson) => lesson.act === act);
}
