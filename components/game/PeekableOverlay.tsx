"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * A choice that covers the table (decree activation, buying an event, discards, swaps…) with a
 * way to look past it, like the hide/view-board control on choice screens in digital card
 * games: "View table" (or V) hides the choice and its backdrop and shows a slim "Back to
 * choice" bar; V or Esc brings it back. The choice stays mounted while hidden, so any
 * half-made selection survives the peek.
 */
export function PeekableOverlay({
  label,
  className,
  onBackdropClick,
  children,
}: {
  /** What's being chosen, for the bar shown while peeking ("Activate a decree"). */
  label: string;
  /** The overlay's own classes: position, z-index, backdrop, layout. */
  className: string;
  onBackdropClick?: () => void;
  children: ReactNode;
}) {
  const [peeking, setPeeking] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "v" || event.key === "V") {
        setPeeking((current) => !current);
      } else if (event.key === "Escape" && peeking) {
        // While peeking, Esc only returns to the choice (it must not also close a dialog).
        event.stopImmediatePropagation();
        setPeeking(false);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [peeking]);

  return (
    <>
      <div className={[className, peeking ? "hidden" : ""].join(" ")} onClick={onBackdropClick}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setPeeking(true);
          }}
          title="Hide this choice to look at the table (V)"
          className="pointer-events-auto absolute top-3 left-1/2 z-10 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-[#0d1117]/95 px-4 py-2 text-sm font-semibold text-stone-50 shadow-[0_0_18px_rgb(142_196_220/0.35),0_8px_20px_rgb(0_0_0/0.6)] ring-2 ring-stamp-blue/80 backdrop-blur transition hover:bg-[#141a24] hover:ring-stamp-blue"
        >
          <EyeIcon />
          View table
        </button>
        {children}
      </div>
      {peeking ? (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex justify-center px-3">
          <div className="rise-in pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-[#0d1117]/95 py-1.5 pr-1.5 pl-4 text-sm shadow-2xl ring-1 ring-[var(--act)]/60">
            <span className="truncate text-stone-200">
              <span className="font-semibold text-[var(--act)]">Choice:</span> {label}
            </span>
            <button
              type="button"
              onClick={() => setPeeking(false)}
              title="Back to the choice (V or Esc)"
              className="shrink-0 cursor-pointer rounded-full bg-[var(--act)] px-3 py-1 text-xs font-semibold text-stone-950 hover:brightness-110"
            >
              Back to choice
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 text-stamp-blue" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}
