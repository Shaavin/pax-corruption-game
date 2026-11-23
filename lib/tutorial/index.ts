/**
 * The tutorial ("Learn to play"): a climb up the ladder, from Town Hall to leading your own
 * party. Short lessons, each from a prepared position (the last base lesson is a whole game),
 * against the computer opponents in order of skill. Legacy & Diplomacy is an optional last chapter.
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
    blurb: "She spotted your talent, and she's tired of politics. Learn the ground floor at her table, and she'll open doors higher up.",
    opponent: "mildred",
  },
  {
    id: "capital",
    title: "The Capital",
    blurb: "Mildred's old friend teaches the over-the-table game: the Senate, the law, decrees, and declaring victory.",
    opponent: "crane",
  },
  {
    id: "palace",
    title: "The Old Palace",
    blurb: "His office ended with the Vitalic Wars, but he never really left. He recruits talent, plays politics in the shadows, and finally lets you lead a party of your own.",
    opponent: "vex",
  },
  {
    id: "foreign",
    title: "Foreign Ministry",
    blurb: "Optional: the Legacy & Diplomacy expansion. Events, World Powers, and the two victories only it has.",
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
