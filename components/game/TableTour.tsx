"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const TABLE_TOUR_KEY = "pax-table-tour-v1";

type TourStep = {
  id: string;
  title: string;
  body: string;
  target: string | null;
};

const STEPS: TourStep[] = [
  {
    id: "table",
    title: "The table",
    body: "Four district lanes run vertically. Your hand sits at the bottom; theirs is face-down at the top. The market, monuments, and draw deck sit on the rail above your hand.",
    target: null,
  },
  {
    id: "support",
    title: "Support piles",
    body: "Discarded cards land here and each is worth 1 influence in that district. The left count is your opponent; the right count is you.",
    target: "support",
  },
  {
    id: "delta",
    title: "Support lead (Δ)",
    body: "Δ is your pile minus theirs. If you ever lead by 9 or more in any one district, you win Popularity immediately.",
    target: "delta",
  },
  {
    id: "electors",
    title: "Electors",
    body: "When an election is scored, the district winner takes electors equal to the civil cards in play there. Dashes mean no election is running yet.",
    target: "electors",
  },
  {
    id: "influence",
    title: "Civil influence",
    body: "The large number on a civil card is its influence in that district once it is in your tableau. Hover any face-up card to inspect the full art.",
    target: "your-tableau",
  },
  {
    id: "partisans",
    title: "Partisans",
    body: "How many times you have recruited. If you lead by 3 or more, you win Military Victory immediately.",
    target: "partisans",
  },
  {
    id: "deck",
    title: "Market and deck",
    body: "Income lets you take one market card, then draw. The number is cards left in the draw deck — 92 after a Standard setup. Face-up monuments beside the market are what you can construct.",
    target: "market",
  },
];

type Highlight = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type TableTourProps = {
  onVisibilityChange?: (open: boolean) => void;
};

const GAP = 14;
const MARGIN = 16;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function placeTooltip(
  h: Highlight | null,
  vw: number,
  vh: number,
  tipW: number,
  tipH: number,
): { top: number; left: number } {
  const maxLeft = Math.max(MARGIN, vw - tipW - MARGIN);
  const maxTop = Math.max(MARGIN, vh - tipH - MARGIN);
  if (!h) {
    return {
      top: clamp((vh - tipH) / 2, MARGIN, maxTop),
      left: clamp((vw - tipW) / 2, MARGIN, maxLeft),
    };
  }

  type Side = "left" | "right" | "top" | "bottom";
  const pos: Record<
    Side,
    { top: number; left: number; space: number; fits: boolean }
  > = {
    left: {
      space: h.left - MARGIN,
      fits: h.left - MARGIN >= tipW + GAP,
      left: h.left - GAP - tipW,
      top: h.top + h.height / 2 - tipH / 2,
    },
    right: {
      space: vw - (h.left + h.width) - MARGIN,
      fits: vw - (h.left + h.width) - MARGIN >= tipW + GAP,
      left: h.left + h.width + GAP,
      top: h.top + h.height / 2 - tipH / 2,
    },
    top: {
      space: h.top - MARGIN,
      fits: h.top - MARGIN >= tipH + GAP,
      left: h.left + h.width / 2 - tipW / 2,
      top: h.top - GAP - tipH,
    },
    bottom: {
      space: vh - (h.top + h.height) - MARGIN,
      fits: vh - (h.top + h.height) - MARGIN >= tipH + GAP,
      left: h.left + h.width / 2 - tipW / 2,
      top: h.top + h.height + GAP,
    },
  };

  const nearBottom = h.top + h.height > vh * 0.65;
  const nearTop = h.top < vh * 0.2;
  const nearRight = h.left + h.width / 2 > vw * 0.62;
  const nearLeft = h.left + h.width / 2 < vw * 0.38;
  const wide = h.width > vw * 0.45;
  const tall = h.height > vh * 0.28;

  let order: Side[] = ["bottom", "top", "right", "left"];
  if (tall) order = ["right", "left", "top", "bottom"];
  if (wide) order = ["top", "bottom", "left", "right"];
  else if (nearBottom && nearRight) order = ["left", "top", "right", "bottom"];
  else if (nearRight) order = ["left", "top", "bottom", "right"];
  else if (nearLeft) order = ["right", "top", "bottom", "left"];
  else if (nearBottom) order = ["top", "left", "right", "bottom"];
  else if (nearTop) order = ["bottom", "left", "right", "top"];

  const fitted = order.map((side) => pos[side]).find((p) => p.fits);
  const picked =
    fitted ??
    [...order.map((side) => pos[side])].sort((a, b) => b.space - a.space)[0];

  return {
    top: clamp(picked.top, MARGIN, maxTop),
    left: clamp(picked.left, MARGIN, maxLeft),
  };
}

export function TableTour({ onVisibilityChange }: TableTourProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [pos, setPos] = useState({ top: 80, left: 80 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(TABLE_TOUR_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    onVisibilityChange?.(open);
  }, [open, onVisibilityChange]);

  useLayoutEffect(() => {
    if (!open) {
      setHighlight(null);
      return;
    }

    const layout = () => {
      const target = STEPS[step]?.target;
      let nextHighlight: Highlight | null = null;
      if (target) {
        const el = document.querySelector(`[data-tour="${target}"]`);
        if (el instanceof HTMLElement) {
          const rect = el.getBoundingClientRect();
          nextHighlight = {
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          };
        }
      }
      setHighlight(nextHighlight);
      const tip = tooltipRef.current;
      const tipW = tip?.offsetWidth || Math.min(320, window.innerWidth - 32);
      const tipH = tip?.offsetHeight || 240;
      setPos(
        placeTooltip(nextHighlight, window.innerWidth, window.innerHeight, tipW, tipH),
      );
    };

    layout();
    const frame = requestAnimationFrame(layout);
    window.addEventListener("resize", layout);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", layout);
    };
  }, [open, step]);

  function persist() {
    try {
      localStorage.setItem(TABLE_TOUR_KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
  }

  function finish() {
    persist();
    setStep(0);
    setOpen(false);
  }

  function next() {
    if (step >= STEPS.length - 1) {
      finish();
      return;
    }
    setStep((n) => n + 1);
  }

  function back() {
    setStep((n) => Math.max(0, n - 1));
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <>
      <button
        type="button"
        className="rounded px-2 py-0.5 tracking-[0.12em] uppercase hover:text-stone-300"
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
      >
        Table guide
      </button>

      {open && current ? (
        <div
          className="fixed inset-0 z-[70] overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="table-tour-title"
        >
          {highlight ? (
            <div
              className="pointer-events-none absolute rounded-md ring-2 ring-[var(--brass)]"
              style={{
                top: highlight.top,
                left: highlight.left,
                width: highlight.width,
                height: highlight.height,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.58)",
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-black/55" />
          )}
          <div className="absolute inset-0" aria-hidden />

          <div
            ref={tooltipRef}
            className="absolute z-10 w-[min(20rem,calc(100vw-2rem))] rounded-lg bg-[#221c16] p-4 text-stone-100 shadow-2xl ring-1 ring-white/10"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="text-[0.65rem] font-semibold tracking-[0.16em] text-[var(--brass)] uppercase">
              {step + 1} / {STEPS.length}
            </div>
            <h2 id="table-tour-title" className="mt-1 text-lg font-semibold">
              {current.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-300">
              {current.body}
            </p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                className="text-sm text-stone-400 hover:text-stone-200"
                onClick={finish}
              >
                Skip
              </button>
              <div className="flex gap-2">
                {step > 0 ? (
                  <button
                    type="button"
                    className="rounded-full px-3 py-1.5 text-sm text-stone-300 hover:bg-white/5"
                    onClick={back}
                  >
                    Back
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-full bg-[var(--brass)] px-4 py-1.5 text-sm font-semibold text-stone-950 hover:bg-[#d4b57c]"
                  onClick={next}
                >
                  {last ? "Done" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
