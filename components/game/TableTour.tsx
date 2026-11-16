"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

export const TABLE_TOUR_KEY = "pax-table-tour-v10";

/** Which half of the phone layout a step needs on screen. */
export type TourView = "districts" | "table";

export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** `data-tour` anchor to spotlight; null centres the card with no spotlight. */
  target: string | null;
  view?: TourView;
};

type StepText = { title: string; body: string };
type StepDef = {
  id: string;
  target: string | null;
  view?: TourView;
  desktop: StepText;
  /** Phone wording, where touch or the layout differs. */
  phone?: Partial<StepText>;
  /** Legacy & Diplomacy wording, where victories or the Market work differently. */
  expansion?: Partial<StepText>;
  expansionOnly?: boolean;
};

/**
 * The one walkthrough ("How to play"): each rule is explained while its part of the table is
 * spotlighted, and each victory at the component that tracks it. Expansion wording covers the
 * five victories that start inactive, buying events, and the two-row election Market.
 */
const STEP_DEFS: StepDef[] = [
  {
    id: "welcome",
    target: null,
    desktop: {
      title: "Welcome to Pax Corruption",
      body: "Two parties compete for a country of four districts. This guide shows the table and how to win. Arrow keys step through, Esc skips; reopen it from How to play.",
    },
    phone: {
      body: "Two parties compete for a country of four districts. This guide shows the table and how to win. Reopen it from the ⋯ menu.",
    },
  },
  {
    id: "victories",
    target: "victories",
    view: "table",
    desktop: {
      title: "Ways to win",
      body: "Win the last election (Civil), meet two active decrees (Political), or lead in partisans, support, or symbols (Military, Popularity, Ideological). This panel tracks every target; declare a win in your Politics step.",
    },
    expansion: {
      body: "Civil and Political are active from the start; legacy events switch on the other five. This panel shows each target, which are active, and your symbol counts (Ideological). Declare a win in your Politics step.",
    },
  },
  {
    id: "hand",
    target: "your-hand",
    view: "districts",
    desktop: {
      title: "Your hand",
      body: "Click a card and the places it can go light up. Hover any face-up card to see it full size.",
    },
    phone: {
      body: "Tap a card and the places it can go light up. Press and hold a card to see it full size.",
    },
  },
  {
    id: "turn",
    target: "turn",
    desktop: {
      title: "Your turn",
      body: "Action: one main action, plus any free actions. Politics: seat a Senator, propose a policy, or declare a victory. Income: take a Market card, then draw if under your hand limit.",
    },
    expansion: {
      body: "Action: one main action, plus any free actions. Politics: seat a Senator, propose a policy, or declare a victory. Income: take a Market card or buy an event, then draw if under your hand limit.",
    },
  },
  {
    id: "actions",
    target: "action-cards",
    view: "districts",
    desktop: {
      title: "Special actions",
      body: "Recruit, Construct, Propose policy, and free actions appear here when available. Hover a dimmed one to see why.",
    },
    phone: {
      body: "Recruit, Construct, Propose policy, and free actions appear above your hand. Tap a dimmed one to see why.",
    },
  },
  {
    id: "district",
    target: "district",
    view: "districts",
    desktop: {
      title: "Districts",
      body: "Yours below the plate, theirs above. Inf is civil card numbers plus 1 per support-pile card; more Inf wins the district at an election. Pop is your support pile: lead by 9 for Popularity Victory.",
    },
    expansion: {
      body: "Yours below the plate, theirs above. Inf is civil card numbers plus 1 per support-pile card; more Inf wins the district at an election. Pop is your support pile: lead by 9 for Popularity Victory, once it's active.",
    },
  },
  {
    id: "numbers",
    target: "partisans",
    desktop: {
      title: "Partisans and Lords",
      body: "Lead by 3 partisans for Military Victory. Lords (alliance handshakes) decides the Council of Lords, the fifth electorate.",
    },
    expansion: {
      body: "Lead by 3 partisans for Military Victory, once it's active. Lords (alliance handshakes) decides the Council of Lords, the fifth electorate.",
    },
  },
  {
    id: "elections",
    target: "elections",
    view: "table",
    desktop: {
      title: "General Elections",
      body: "Four are hidden in the deck. When one appears, the Market stops refilling; once it's empty, the election is scored. The winner activates decrees, and the last election decides Civil Victory.",
    },
    expansion: {
      body: "Four are hidden in the deck. When one appears, the Market splits into two rows and stops refilling; once its main cards are gone, the election is scored. The winner activates decrees, and the last election decides Civil Victory.",
    },
  },
  {
    id: "senate",
    target: "senate",
    view: "table",
    desktop: {
      title: "The Senate",
      body: "In Politics, seat a card here, or reveal cards that convince a majority of votes to change a policy.",
    },
  },
  {
    id: "decrees",
    target: "decrees",
    view: "table",
    desktop: {
      title: "Decrees",
      body: "Election winners activate these. Meet two active decrees at once for Political Victory; the dots show who meets each.",
    },
  },
  {
    id: "market",
    target: "market",
    view: "table",
    desktop: {
      title: "The Market",
      body: "At Income, take one card here.",
    },
    expansion: {
      body: "At Income, take one card here or buy an event (◆ is its cost).",
    },
  },
  {
    id: "world",
    target: "world",
    view: "table",
    expansionOnly: true,
    desktop: {
      title: "The World",
      body: "Events in play and your relations with the World Powers. Each event you buy is +1 relation; lead with 3 of the 4 for Diplomatic Victory, once it's active.",
    },
  },
  {
    id: "monuments",
    target: "supply",
    view: "table",
    desktop: {
      title: "Monuments",
      body: "Discard 5 cards of a monument's district to build it and keep its ability.",
    },
    expansion: {
      body: "Discard 5 cards of a monument's district to build it and keep its ability. Lead by 2 monuments for Cultural Victory, once it's active.",
    },
  },
  {
    id: "history",
    target: "history",
    desktop: {
      title: "History",
      body: "Every public move, tinted by who made it. Stuck? Hover anything greyed out for why, or any number for what it means.",
    },
    phone: {
      title: "The log",
      body: "Tap Log for every public move. Tap anything greyed out for why. Good luck!",
    },
  },
];

/** The tour for this layout and game. */
export function tableTourSteps({ compact, expansion }: { compact: boolean; expansion: boolean }): TourStep[] {
  return STEP_DEFS.filter((def) => expansion || !def.expansionOnly).map((def) => ({
    id: def.id,
    target: def.target,
    view: def.view,
    title: (compact && def.phone?.title) || (expansion && def.expansion?.title) || def.desktop.title,
    body: (compact && def.phone?.body) || (expansion && def.expansion?.body) || def.desktop.body,
  }));
}

// --- Seen flag ---------------------------------------------------------------------------------

const seenListeners = new Set<() => void>();

function readSeen(): boolean {
  try {
    return localStorage.getItem(TABLE_TOUR_KEY) !== null;
  } catch {
    return false;
  }
}

/** Whether this browser has finished or skipped the tour. True while rendering on the server. */
export function useTourSeen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      seenListeners.add(onChange);
      return () => seenListeners.delete(onChange);
    },
    readSeen,
    () => true,
  );
}

export function markTourSeen() {
  try {
    localStorage.setItem(TABLE_TOUR_KEY, "1");
  } catch {
    /* private mode: the tour will just show again next time */
  }
  seenListeners.forEach((listener) => listener());
}

// --- Overlay -----------------------------------------------------------------------------------

type Box = { top: number; left: number; width: number; height: number };

const GAP = 12;
const MARGIN = 12;
const PAD = 6;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Side = "left" | "right" | "top" | "bottom";

/** Put the card beside the spotlight on whichever side has room, never on top of it if avoidable. */
function placeCard(h: Box | null, vw: number, vh: number, w: number, ht: number): { top: number; left: number } {
  const maxLeft = Math.max(MARGIN, vw - w - MARGIN);
  const maxTop = Math.max(MARGIN, vh - ht - MARGIN);
  if (!h) return { top: clamp((vh - ht) / 2, MARGIN, maxTop), left: clamp((vw - w) / 2, MARGIN, maxLeft) };

  const room: Record<Side, number> = {
    top: h.top - MARGIN - GAP,
    bottom: vh - (h.top + h.height) - MARGIN - GAP,
    left: h.left - MARGIN - GAP,
    right: vw - (h.left + h.width) - MARGIN - GAP,
  };
  const fits: Record<Side, boolean> = {
    top: room.top >= ht,
    bottom: room.bottom >= ht,
    left: room.left >= w,
    right: room.right >= w,
  };
  const at: Record<Side, { top: number; left: number }> = {
    top: { top: h.top - GAP - ht, left: h.left + h.width / 2 - w / 2 },
    bottom: { top: h.top + h.height + GAP, left: h.left + h.width / 2 - w / 2 },
    left: { top: h.top + h.height / 2 - ht / 2, left: h.left - GAP - w },
    right: { top: h.top + h.height / 2 - ht / 2, left: h.left + h.width + GAP },
  };
  // Prefer the side facing the middle of the screen.
  const vertical: Side[] = h.top + h.height / 2 > vh / 2 ? ["top", "bottom"] : ["bottom", "top"];
  const horizontal: Side[] = h.left + h.width / 2 > vw / 2 ? ["left", "right"] : ["right", "left"];
  const order = h.width > vw * 0.5 ? [...vertical, ...horizontal] : [...horizontal, ...vertical];
  const side = order.find((s) => fits[s]);
  if (side) return { top: clamp(at[side].top, MARGIN, maxTop), left: clamp(at[side].left, MARGIN, maxLeft) };
  // Nothing fits (a big target on a small screen): pin to the edge farthest from the target's middle.
  const centre = h.top + h.height / 2;
  return { top: centre > vh / 2 ? MARGIN : maxTop, left: clamp((vw - w) / 2, MARGIN, maxLeft) };
}

function measure(target: string | null): Box | null {
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!(el instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  // Only the part that's on screen (the hand hangs off the bottom edge).
  const top = Math.max(rect.top, 0);
  const left = Math.max(rect.left, 0);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  const right = Math.min(rect.right, window.innerWidth);
  return { top: top - PAD, left: left - PAD, width: right - left + PAD * 2, height: bottom - top + PAD * 2 };
}

type TableTourProps = {
  steps: readonly TourStep[];
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
};

/** A spotlight walk-through of the table. Controlled: the table owns whether it's open and which step. */
export function TableTour({ steps, step, onStep, onClose }: TableTourProps) {
  const [spot, setSpot] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const current = steps[step];
  const last = step === steps.length - 1;
  const target = current?.target ?? null;

  useLayoutEffect(() => {
    let frame = 0;
    const layout = () => {
      const box = measure(target);
      const card = cardRef.current;
      const w = card?.offsetWidth ?? Math.min(320, window.innerWidth - 2 * MARGIN);
      const h = card?.offsetHeight ?? 200;
      setSpot(box);
      setPos(placeCard(box, window.innerWidth, window.innerHeight, w, h));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };
    // Bring the target into view first (the side panel and phone panels scroll).
    const el = target ? document.querySelector(`[data-tour="${target}"]`) : null;
    if (el instanceof HTMLElement) el.scrollIntoView({ block: "nearest", inline: "nearest" });
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [target, step]);

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") {
        if (step >= steps.length - 1) onClose();
        else onStep(step + 1);
      } else if (event.key === "ArrowLeft" && step > 0) onStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, steps.length, onStep, onClose]);

  if (!current) return null;
  const moving = "transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none";

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="table-tour-title">
      {spot ? (
        <div
          aria-hidden
          className={`pointer-events-none absolute rounded-xl ring-2 ring-stamp-blue ${moving}`}
          style={{ ...spot, boxShadow: "0 0 0 9999px rgba(0,0,0,0.62), 0 0 24px rgba(142,196,220,0.35)" }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/62" />
      )}
      {/* Clicks outside the card do nothing (the table stays inert while touring). */}
      <div aria-hidden className="absolute inset-0" />

      <div
        ref={cardRef}
        className={`absolute z-10 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl glass-strong p-4 text-stone-100 shadow-2xl ring-1 ring-white/10 ${moving} ${pos ? "" : "invisible"}`}
        style={pos ?? { top: 0, left: 0 }}
      >
        <div className="flex items-center justify-between gap-3">
          <ol className="flex gap-1" aria-label={`Step ${step + 1} of ${steps.length}`}>
            {steps.map((entry, index) => (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-label={`Go to step ${index + 1}: ${entry.title}`}
                  aria-current={index === step ? "step" : undefined}
                  onClick={() => onStep(index)}
                  className={[
                    "block h-1.5 cursor-pointer rounded-full transition-all",
                    index === step ? "w-4 bg-stamp-blue" : "w-1.5 bg-white/20 hover:bg-white/40",
                  ].join(" ")}
                />
              </li>
            ))}
          </ol>
          <button
            type="button"
            aria-label="Close the tour"
            onClick={onClose}
            className="-m-1.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-stone-400 hover:bg-white/8 hover:text-stone-100"
          >
            ×
          </button>
        </div>
        <h2 id="table-tour-title" className="mt-2.5 text-lg leading-snug font-semibold">
          {current.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-300">{current.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          {last ? (
            <span />
          ) : (
            <button
              type="button"
              className="cursor-pointer text-sm text-stone-400 hover:text-stone-200"
              onClick={onClose}
            >
              Skip tour
            </button>
          )}
          <div className="flex gap-2">
            {step > 0 ? (
              <button
                type="button"
                className="cursor-pointer rounded-full px-3 py-1.5 text-sm text-stone-300 hover:bg-white/5"
                onClick={() => onStep(step - 1)}
              >
                Back
              </button>
            ) : null}
            <button
              ref={nextRef}
              type="button"
              className="cursor-pointer rounded-xl bg-pax-red px-4 py-1.5 text-sm font-semibold text-white hover:bg-pax-red-deep"
              onClick={() => (last ? onClose() : onStep(step + 1))}
            >
              {last ? "Start playing" : step === 0 ? "Show me" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
