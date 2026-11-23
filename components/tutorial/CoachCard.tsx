"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { placeCard, type Box } from "../game/TableTour";
import { useCompact } from "../game/use-compact";
import { Portrait } from "./Portrait";
import type { CastMember, CoachTarget, LessonStep, MoveStage } from "@/lib/tutorial";

/** An opponent's line, and the lesson step it belongs to (it goes when the step does). */
export type Speech = { text: string; key: number; step: number };
export type CoachNotice = { text: string; key: number };

type CoachCardProps = {
  /** The step on show, or null while the opponent moves. */
  step: LessonStep | null;
  stepIndex: number;
  stepCount: number;
  /** Where the learner is in a several-click move: a step's matching note replaces its body. */
  stage: MoveStage;
  opponent: CastMember;
  /** The opponent's latest line. */
  speech: Speech | null;
  /** Why the last move was refused. */
  notice: CoachNotice | null;
  onNext: () => void;
};

const MARGIN = 12;
const PAD = 6;

function selectorFor(target: CoachTarget): string {
  return target.startsWith("lane:") ? `[data-lane="${target.slice(5)}"]` : `[data-tour="${target}"]`;
}

/** The on-screen box around a target, or null if it isn't showing (e.g. the other phone view). */
function measure(target: CoachTarget | undefined): Box | null {
  if (!target) return null;
  for (const element of document.querySelectorAll<HTMLElement>(selectorFor(target))) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const top = Math.max(rect.top, 0);
    const left = Math.max(rect.left, 0);
    const bottom = Math.min(rect.bottom, window.innerHeight);
    const right = Math.min(rect.right, window.innerWidth);
    if (bottom <= top || right <= left) continue;
    return { top: top - PAD, left: left - PAD, width: right - left + PAD * 2, height: bottom - top + PAD * 2 };
  }
  return null;
}

/** While you play with nothing to point at: the top right of the board, clear of the hand and plates. */
function besideBoard(width: number): { top: number; left: number } {
  const board = document.querySelector<HTMLElement>('[data-tour="lanes"]')?.getBoundingClientRect();
  if (!board || board.width === 0) return { top: MARGIN, left: Math.max(MARGIN, window.innerWidth - width - MARGIN) };
  return { top: board.top + MARGIN, left: Math.max(MARGIN, board.right - width - MARGIN) };
}

/** The panel of a decision overlay (setup, decree, policy, event) covering the table, if one is open. */
function modalPanel(): DOMRect | null {
  for (const overlay of document.querySelectorAll<HTMLElement>("[data-modal]")) {
    if (overlay.getClientRects().length === 0) continue;
    // The dialog itself; the shared overlay puts its panel after the "View table" button.
    const panel = overlay.querySelector<HTMLElement>("[role=dialog]") ?? (overlay.lastElementChild as HTMLElement | null) ?? overlay;
    return panel.getBoundingClientRect();
  }
  return null;
}

/** The card's usual width (21rem), and the narrowest it gets to fit beside a decision. */
const CARD_WIDTH = 336;
const NARROWEST = 240;

/** Beside an open decision, on the side with more room, narrowed to fit; null when it would cover the decision. */
function besideModal(panel: DOMRect): { top: number; left: number; width: number } | null {
  const top = Math.max(MARGIN, Math.round(panel.top));
  const leftRoom = panel.left - MARGIN * 2;
  const rightRoom = window.innerWidth - panel.right - MARGIN * 2;
  const room = Math.max(leftRoom, rightRoom);
  if (room < NARROWEST) return null;
  const width = Math.min(CARD_WIDTH, Math.floor(room));
  return leftRoom >= rightRoom ? { top, left: MARGIN, width } : { top, left: window.innerWidth - width - MARGIN, width };
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1
  );
}

/**
 * The lesson's coach: a card with the current note and a spotlight on what it talks about.
 * Unlike the "How to play" tour it doesn't block the table: you play through it. Notes that
 * only need reading dim the rest of the table and wait for Next.
 */
export function CoachCard({ step, stepIndex, stepCount, stage, opponent, speech, notice, onNext }: CoachCardProps) {
  const compact = useCompact();
  const [spot, setSpot] = useState<Box | null>(null);
  const [modal, setModal] = useState(false);
  /** A decision is open and there's no room beside it: the card folds to a pill instead of covering it. */
  const [cramped, setCramped] = useState(false);
  /** The card's width while it waits beside a decision (narrower than usual when space is short). */
  const [asideWidth, setAsideWidth] = useState<number | null>(null);
  /** The step whose note was opened from the pill, over the decision. */
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [collapsedAt, setCollapsedAt] = useState<number | null>(null);
  const [hintFor, setHintFor] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  // Part-way through a move, the step's note for that part says what to click next.
  const stageNote = step?.kind === "do" ? step.stages?.[stage] : undefined;
  const target = stageNote?.target ?? step?.target;
  const body = stageNote?.body ?? step?.body;
  const explain = step?.kind === "explain";
  // Folding the card lasts until the next step.
  const collapsed = collapsedAt === stepIndex && step !== null;
  const showHint = hintFor === stepIndex && step?.kind === "free";

  // Follow the target and the table: re-measure on resize, scroll, and a short beat (moves
  // and card motion change the layout without a resize).
  useLayoutEffect(() => {
    let frame = 0;
    const layout = () => {
      const box = measure(target);
      const panel = modalPanel();
      const covered = panel !== null;
      setSpot((current) => (sameBox(current, box) ? current : box));
      setModal(covered);
      const card = cardRef.current;
      const w = card?.offsetWidth ?? 320;
      const h = card?.offsetHeight ?? 180;
      const aside = panel ? besideModal(panel) : null;
      setCramped(covered && aside === null);
      setAsideWidth(aside ? aside.width : null);
      const next = covered
        ? (aside ? { top: aside.top, left: aside.left } : { top: MARGIN, left: MARGIN })
        : box
          ? placeCard(box, window.innerWidth, window.innerHeight, w, h)
          : explain
            ? { top: Math.max(MARGIN, Math.round(window.innerHeight * 0.14)), left: Math.max(MARGIN, (window.innerWidth - w) / 2) }
            : besideBoard(w);
      setPos((current) => (current && Math.abs(current.top - next.top) < 1 && Math.abs(current.left - next.left) < 1 ? current : next));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };
    schedule();
    const timer = window.setInterval(schedule, 400);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [target, stepIndex, compact, collapsed, showHint, notice, speech, explain, body]);

  // Notes that need reading take the keyboard focus, so Enter or Space moves on.
  useEffect(() => {
    if (explain && !collapsed) nextRef.current?.focus({ preventScroll: true });
  }, [explain, stepIndex, collapsed]);

  const waiting = step === null;
  const moving = "transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none";
  const spotlight =
    spot && !modal && !collapsed ? (
      <div
        aria-hidden
        className={`pointer-events-none fixed z-[71] rounded-xl ring-2 ring-[var(--act)] ${moving}`}
        style={{
          ...spot,
          boxShadow: explain
            ? "0 0 0 9999px rgba(0,0,0,0.5), 0 0 26px color-mix(in srgb, var(--act) 45%, transparent)"
            : "0 0 26px color-mix(in srgb, var(--act) 55%, transparent)",
        }}
      />
    ) : explain && !modal && !collapsed ? (
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[71] bg-black/45" />
    ) : null;

  // Phones: a slim bar at the top while folded (or while a decision covers the table). Wider
  // screens too, while a decision is open with no room beside it. Pressing it opens the note.
  const pillForDecision = modal && !explain && openedAt !== stepIndex && (compact || cramped);
  if ((compact && collapsed) || pillForDecision) {
    return (
      <button
        type="button"
        onClick={() => {
          setCollapsedAt(null);
          setOpenedAt(stepIndex);
        }}
        className="fixed top-2 right-2 z-[72] flex max-w-[70vw] cursor-pointer items-center gap-2 rounded-full glass-strong px-3 py-1.5 text-xs font-semibold text-stone-100 shadow-xl ring-1 ring-[var(--act)]/60"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--act)]" aria-hidden />
        <span className="truncate">{step ? step.title : `${opponent.name}'s turn`}</span>
      </button>
    );
  }
  if (!compact && collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsedAt(null)}
        className="fixed top-14 left-1/2 z-[72] flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full glass-strong px-4 py-1.5 text-sm font-semibold text-stone-100 shadow-xl ring-1 ring-[var(--act)]/60"
      >
        <span className="h-2 w-2 rounded-full bg-[var(--act)]" aria-hidden />
        {step ? step.title : `${opponent.name}'s turn`}
        <span className="text-stone-400">· show note</span>
      </button>
    );
  }

  const placement = compact
    ? "fixed inset-x-2 top-2 max-h-[46dvh] overflow-y-auto"
    : `fixed w-[min(21rem,calc(100vw-1.5rem))] ${moving}`;

  return (
    <>
      {spotlight}
      <section
        ref={cardRef}
        aria-live="polite"
        aria-label="Lesson coach"
        className={`${placement} z-[72] rounded-2xl glass-strong p-3.5 text-stone-100 shadow-2xl ring-1 ring-white/10 ${!compact && !pos ? "invisible" : ""}`}
        style={compact ? undefined : { ...(pos ?? { top: 0, left: 0 }), ...(asideWidth ? { width: asideWidth } : {}) }}
      >
        <header className="flex items-center justify-between gap-3 text-[0.65rem] font-semibold tracking-[0.14em] text-stone-400 uppercase">
          <span>{waiting ? "Their turn" : `Step ${Math.min(stepIndex + 1, stepCount)} of ${stepCount}`}</span>
          <span className="flex items-center gap-1">
            {step?.kind === "free" && step.hint ? (
              <button
                type="button"
                onClick={() => setHintFor(showHint ? null : stepIndex)}
                className="cursor-pointer rounded-full px-2 py-0.5 tracking-normal normal-case text-[var(--act)] hover:bg-white/8"
              >
                {showHint ? "Hide hint" : "Hint"}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Fold the note away"
              title="Fold the note away (it comes back with the next one)"
              onClick={() => {
                setCollapsedAt(stepIndex);
                setOpenedAt(null);
              }}
              className="-mr-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-base leading-none text-stone-400 hover:bg-white/8 hover:text-stone-100"
            >
              –
            </button>
          </span>
        </header>

        {speech ? (
          <div key={speech.key} className="rise-in mt-2 flex items-start gap-2.5 rounded-xl bg-white/[0.05] px-2.5 py-2">
            <Portrait member={opponent} size="sm" />
            <p className="text-[0.8rem] leading-snug text-stone-200">
              <span className="font-semibold" style={{ color: opponent.color }}>
                {opponent.name}:
              </span>{" "}
              “{speech.text}”
            </p>
          </div>
        ) : null}

        {waiting ? (
          <div className="mt-2.5 flex items-center gap-2.5">
            {speech ? null : <Portrait member={opponent} size="sm" />}
            <p className="text-sm text-stone-300">
              {opponent.name} is making their move. Watch the table.
            </p>
          </div>
        ) : (
          <>
            <h2 className="mt-2.5 text-base leading-snug font-semibold">{step.title}</h2>
            <p key={body} className={["mt-1 text-sm leading-relaxed text-stone-300", stageNote ? "rise-in" : ""].join(" ")}>
              {body}
            </p>
            {showHint && step.kind === "free" ? (
              <p className="rise-in mt-2 rounded-lg bg-[var(--act)]/10 px-2.5 py-2 text-sm leading-snug text-[var(--act)] ring-1 ring-[var(--act)]/30">
                {step.hint}
              </p>
            ) : null}
            {notice ? (
              <p
                key={notice.key}
                role="status"
                className="rise-in mt-2 rounded-lg bg-pax-red/15 px-2.5 py-2 text-sm leading-snug text-stone-100 ring-1 ring-pax-red/50"
              >
                {notice.text}
              </p>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-stone-500">
                {step.kind === "explain" ? "" : step.kind === "do" ? "Your move" : "Your move: anything legal"}
              </span>
              {step.kind === "explain" ? (
                <button
                  ref={nextRef}
                  type="button"
                  onClick={onNext}
                  className="cursor-pointer rounded-xl bg-pax-red px-4 py-1.5 text-sm font-semibold text-white hover:bg-pax-red-deep"
                >
                  Next
                </button>
              ) : null}
            </div>
          </>
        )}
      </section>
    </>
  );
}
