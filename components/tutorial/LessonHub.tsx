"use client";

import Link from "next/link";
import { Portrait } from "./Portrait";
import { lessonUnlocked, nextUp, setUnlockAll, useTutorialProgress } from "./progress";
import { ACTS, CAST, LESSONS, lessonsInAct } from "@/lib/tutorial";

/** The lesson list: three chapters up the ladder against the computer cast, then the optional expansion chapter. */
export function LessonHub() {
  const progress = useTutorialProgress();
  const upNext = nextUp(progress);
  const done = LESSONS.filter((lesson) => progress.done.includes(lesson.id)).length;
  const baseLessons = LESSONS.filter((lesson) => !lesson.expansion);
  const baseDone = baseLessons.every((lesson) => progress.done.includes(lesson.id));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 className="text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">Learn to play</h1>
          <p className="mt-3 text-base leading-relaxed text-stone-300">
            Climb the ladder from Town Hall to leading your own party. Short lessons at a real table add a few pieces
            of the game at a time, against the computer&apos;s three politicians, from the friendliest to the most
            cunning, and end with a whole game.
          </p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-sm text-stone-400 tabular-nums">
            {done} of {LESSONS.length} lessons done
          </p>
          <div className="mt-1.5 h-1.5 w-48 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
            <div className="h-full rounded-full bg-[var(--act)] transition-[width]" style={{ width: `${(done / LESSONS.length) * 100}%` }} />
          </div>
          {upNext ? (
            <a
              href={`/learn/play?lesson=${upNext}`}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-pax-red px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgb(168_29_17/0.7)] hover:bg-pax-red-deep"
            >
              {done === 0 ? "Start the first lesson" : "Continue"} <span aria-hidden>→</span>
            </a>
          ) : null}
        </div>
      </div>

      {ACTS.map((act) => {
        const member = CAST[act.opponent];
        const lessons = lessonsInAct(act.id);
        return (
          <section key={act.id} aria-labelledby={`act-${act.id}`} className="rounded-3xl border border-white/[0.08] bg-[#0d1117]/70 p-4 backdrop-blur sm:p-5">
            <header className="flex items-start gap-3.5">
              <Portrait member={member} size="lg" />
              <div className="min-w-0">
                <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-stone-500 uppercase">
                  {act.expansion ? "Optional · Legacy & Diplomacy" : `Chapter ${ACTS.indexOf(act) + 1}`}
                </p>
                <h2 id={`act-${act.id}`} className="text-xl font-semibold text-stone-100">
                  {act.title}
                </h2>
                <p className="mt-0.5 text-sm text-stone-400">
                  <span className="font-semibold" style={{ color: member.color }}>
                    {member.name}
                  </span>
                  , {member.role}. {act.blurb}
                </p>
                {act.expansion && !baseDone && !progress.unlockAll ? (
                  <p className="mt-1 text-xs text-stone-500">Opens after A Star is Born, or unlock every lesson below.</p>
                ) : null}
              </div>
            </header>
            <ol className="mt-4 grid gap-2">
              {lessons.map((lesson) => {
                const number = LESSONS.indexOf(lesson) + 1;
                const finished = progress.done.includes(lesson.id);
                const open = lessonUnlocked(progress, lesson.id);
                const current = lesson.id === upNext && open;
                return (
                  <li key={lesson.id}>
                    <div
                      className={[
                        "flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition",
                        current
                          ? "border-[var(--act)]/50 bg-[var(--act)]/[0.06]"
                          : "border-white/[0.06] bg-white/[0.025]",
                        open ? "" : "opacity-55",
                      ].join(" ")}
                    >
                      <span
                        aria-hidden
                        className={[
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                          finished ? "bg-[var(--act)] text-stone-950" : "bg-white/[0.07] text-stone-300",
                        ].join(" ")}
                      >
                        {finished ? "✓" : number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-stone-100">
                          {lesson.title}
                          {finished ? <span className="sr-only"> (done)</span> : null}
                        </h3>
                        <p className="text-[0.8rem] leading-snug text-stone-400">{lesson.summary}</p>
                        <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="Covers">
                          {lesson.teaches.map((topic) => (
                            <li key={topic} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[0.65rem] text-stone-300">
                              {topic}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {open ? (
                        <a
                          href={`/learn/play?lesson=${lesson.id}`}
                          aria-label={`${finished ? "Replay" : "Play"} lesson ${number}: ${lesson.title}`}
                          className={[
                            "shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-semibold",
                            current ? "bg-pax-red text-white hover:bg-pax-red-deep" : "text-stone-200 ring-1 ring-white/15 hover:bg-white/5",
                          ].join(" ")}
                        >
                          {finished ? "Replay" : "Play"}
                        </a>
                      ) : (
                        <span className="shrink-0 text-xs text-stone-500" title="Finish the lesson before this one first">
                          Locked
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm text-stone-400 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={progress.unlockAll}
            onChange={(event) => setUnlockAll(event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[var(--act)]"
          />
          <span>
            Unlock every lesson
            <span className="block text-xs text-stone-500">For players who know some of it already.</span>
          </span>
        </label>
        <p>
          Ready for a whole game?{" "}
          <Link href="/" className="text-stamp-blue underline-offset-4 hover:underline">
            Play against the computer
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
