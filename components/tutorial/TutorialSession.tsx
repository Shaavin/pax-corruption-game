"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { captureCards } from "../game/card-motion";
import { HotseatSession, type RemoteGame } from "../game/HotseatSession";
import { rememberedNames } from "../game/players";
import { getSettings } from "../game/settings";
import { CoachCard, type CoachNotice, type Speech } from "./CoachCard";
import { Portrait } from "./Portrait";
import { markLessonDone } from "./progress";
import { createSeededRng, randomUint32 } from "@/lib/game/rng";
import type { Action } from "@/lib/game";
import {
  acknowledge,
  allows,
  CAST,
  isNewGame,
  lessonSeed,
  LESSONS,
  nextLesson,
  opponentMove,
  playOpponent,
  shownStep,
  startLesson,
  submit,
  type Lesson,
  type LessonRun,
  type MoveStage,
} from "@/lib/tutorial";

/** Dimmed and hidden table areas get these classes on the wrapper (see globals.css). */
const DIM_CLASS = (anchor: string) => `tutorial-dim-${anchor}`;
const HIDE_CLASS = (anchor: string) => `tutorial-hide-${anchor}`;

/** One lesson at the table: the engine plays, the coach explains, the opponent follows a script. */
export function TutorialSession({ lesson }: { lesson: Lesson }) {
  const [attempt, setAttempt] = useState(0);
  // A fresh run (and RNG) for every attempt; the key remounts everything below.
  return <LessonTable key={`${lesson.id}-${attempt}`} lesson={lesson} onRestart={() => setAttempt((count) => count + 1)} />;
}

function LessonTable({ lesson, onRestart }: { lesson: Lesson; onRestart: () => void }) {
  const opponent = CAST[lesson.opponent];
  // A whole game is dealt afresh for every attempt; a prepared table is always the same.
  const [seed] = useState(() => lessonSeed(lesson, isNewGame(lesson.scenario) ? randomUint32() : undefined));
  const [run, setRun] = useState<LessonRun>(() => startLesson(lesson, seed));
  const [rng] = useState(() => createSeededRng(seed));
  const [speech, setSpeech] = useState<Speech | null>({ text: lesson.intro, key: 0, step: 0 });
  const [notice, setNotice] = useState<CoachNotice | null>(null);
  /** Where the learner is in a several-click move (the table reports it). */
  const [stage, setStage] = useState<MoveStage>("idle");
  /** A table moment (the parties revealed, an election) is on screen: the opponent and the lesson's end wait for it. */
  const [momentPlaying, setMomentPlaying] = useState(false);
  // The name typed on the menu last time, if any (otherwise the table says "Player 1").
  const [playerName] = useState(() => rememberedNames()[0] || null);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  const step = shownStep(run);

  // The opponent's moves: one at a time, with a beat between them so they can be followed, and
  // none while a moment plays over the table.
  useEffect(() => {
    if (momentPlaying) return;
    const move = opponentMove(run, rng);
    if (!move) return;
    const quiet = move.action.type === "endAction" || move.action.type === "endPolitics" || move.action.type === "passIncome";
    const pace = getSettings().motion === "fast" ? 0.6 : 1;
    const timer = window.setTimeout(
      () => {
        captureCards(move.action.player);
        setRun((current) => (current === run ? playOpponent(current, move, rng) : current));
        if (move.say) setSpeech((current) => ({ text: move.say!, key: (current?.key ?? 0) + 1, step: run.step }));
      },
      (quiet && !move.say ? 450 : 1300) * pace,
    );
    return () => window.clearTimeout(timer);
  }, [run, rng, momentPlaying]);

  // The lesson is over: remember it, and give the opponent the last word.
  const outcome = run.outcome;
  useEffect(() => {
    if (outcome === "complete") markLessonDone(lesson.id);
  }, [outcome, lesson.id]);

  const send = useCallback(
    (action: Action) => {
      const current = runRef.current;
      const result = submit(current, action, rng);
      if ("hint" in result) {
        setNotice((previous) => ({ text: result.hint, key: (previous?.key ?? 0) + 1 }));
        return;
      }
      setNotice(null);
      captureCards(action.player);
      setRun(result.run);
    },
    [rng],
  );

  const next = useCallback(() => {
    setNotice(null);
    setRun((current) => acknowledge(current));
  }, []);

  const remote: RemoteGame = useMemo(
    () => ({
      seat: 0,
      state: run.state,
      history: run.history,
      settings: { mode: run.state.mode, expansion: Boolean(lesson.expansion), foreignInfluence: false },
      canUndo: false,
      send,
      undo: () => {},
      waitingText: `${opponent.name} is thinking…`,
      names: [playerName, opponent.name],
      rematch: null,
      menu: [{ label: "Restart lesson", title: "Start this lesson again from the beginning", onClick: onRestart }],
      allow: (action: Action) => allows(run, action),
      blockedHint:
        step?.kind === "explain"
          ? "Read the note, then press Next."
          : step?.kind === "do"
            ? step.hint
            : "Not in this lesson. Follow the note.",
      label: `Lesson ${LESSONS.indexOf(lesson) + 1}: ${lesson.title}`,
      menuHref: "/learn",
      showTour: false,
      hideGameOver: true,
      view: step && step.kind !== "free" ? (step.view ?? null) : null,
      // A note about the hand shows it in full color; a step asking for one card still greys the rest.
      showHand: step?.kind === "explain" && step.target === "your-hand",
      onStage: setStage,
      onMoment: setMomentPlaying,
      opponentPortrait: opponent.portrait,
    }),
    [run, lesson, opponent.name, opponent.portrait, playerName, send, onRestart, step],
  );

  const classes = [
    ...(lesson.dim ?? []).map(DIM_CLASS),
    ...(lesson.hide ?? []).map(HIDE_CLASS),
    // The Politics step passes by itself here, so the turn panel leaves it out.
    lesson.skipPolitics ? "tutorial-skip-politics" : "",
  ].join(" ");

  return (
    <div className={classes}>
      <HotseatSession remote={remote} />
      {run.outcome === "playing" ? (
        <CoachCard
          step={step}
          stepIndex={run.step}
          stepCount={lesson.steps.length}
          stage={stage}
          opponent={opponent}
          speech={speech?.step === run.step ? speech : null}
          notice={notice}
          onNext={next}
        />
      ) : momentPlaying ? null : (
        <LessonEnd lesson={lesson} run={run} onRestart={onRestart} />
      )}
    </div>
  );
}

/** Finished (the opponent congratulates you, and the next lesson waits) or lost (try again). */
function LessonEnd({ lesson, run, onRestart }: { lesson: Lesson; run: LessonRun; onRestart: () => void }) {
  const opponent = CAST[lesson.opponent];
  const won = run.outcome === "complete";
  const upNext = nextLesson(lesson.id);
  // The base game ends with a whole game against Vex; the expansion chapter is optional, so offer both.
  const graduated = won && (lesson.id === "star" || !upNext);
  const practice = lesson.expansion ? "&expansion=1" : "";
  const hint = lesson.steps.find((step) => step.kind === "free" && step.hint);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-end-title"
        className="rise-in m-auto w-full max-w-md rounded-2xl glass-strong p-5 text-stone-100 shadow-2xl ring-1 ring-white/10 sm:p-6"
      >
        <p className="text-[0.65rem] font-semibold tracking-[0.18em] uppercase" style={{ color: won ? "var(--act)" : opponent.color }}>
          {won ? (run.state.victory ? "Victory · lesson complete" : "Lesson complete") : `${opponent.name} wins`}
        </p>
        <h2 id="lesson-end-title" className="mt-1.5 text-2xl font-semibold">
          {won ? lesson.title : "Not this time"}
        </h2>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-white/[0.05] p-3">
          <Portrait member={opponent} />
          <p className="text-sm leading-relaxed text-stone-200">
            <span className="font-semibold" style={{ color: opponent.color }}>
              {opponent.name}:
            </span>{" "}
            “{won ? lesson.outro : (lesson.lose ?? "Better luck next time.")}”
          </p>
        </div>
        {!won && hint?.kind === "free" ? (
          <p className="mt-3 rounded-lg bg-[var(--act)]/10 px-3 py-2 text-sm leading-snug text-[var(--act)] ring-1 ring-[var(--act)]/30">
            Hint: {hint.hint}
          </p>
        ) : null}
        {graduated ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-semibold text-stone-100">
              {lesson.expansion ? "You know Legacy & Diplomacy." : "You know the base game."} Play a full game:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["mildred", "crane", "vex"] as const).map((id) => (
                <Link
                  key={id}
                  href={`/play?ai=${CAST[id].level}${practice}&n2=${encodeURIComponent(CAST[id].name)}`}
                  className="flex items-center gap-2 rounded-full bg-white/[0.06] py-1 pr-3 pl-1 text-sm text-stone-100 ring-1 ring-white/10 hover:bg-white/[0.1]"
                >
                  <Portrait member={CAST[id]} size="sm" />
                  {CAST[id].name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Link href="/learn" className="rounded-xl px-3 py-2 text-sm text-stone-300 hover:bg-white/5">
            All lessons
          </Link>
          <button
            type="button"
            onClick={onRestart}
            className={[
              "cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold",
              won ? "text-stone-200 ring-1 ring-white/15 hover:bg-white/5" : "bg-pax-red text-white hover:bg-pax-red-deep",
            ].join(" ")}
          >
            {won ? "Replay" : "Try again"}
          </button>
          {won && upNext ? (
            <Link
              href={`/learn/play?lesson=${upNext.id}`}
              className="rounded-xl bg-pax-red px-4 py-2 text-sm font-semibold text-white hover:bg-pax-red-deep"
            >
              {upNext.expansion && !lesson.expansion ? "Expansion lessons" : "Next lesson"} <span aria-hidden>→</span>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
