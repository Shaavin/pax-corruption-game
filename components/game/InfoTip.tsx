"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type InfoTipProps = {
  label: string;
  children: ReactNode;
};

const WIDTH = 224;
const EDGE = 8;

type Spot = { left: number; top?: number; bottom?: number; maxHeight: number };

/** Where the tip goes: under the icon (or over it near the bottom), kept inside the viewport. */
function spotFor(button: HTMLElement): Spot {
  const rect = button.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(WIDTH, vw - 2 * EDGE);
  const left = Math.max(EDGE, Math.min(rect.left + rect.width / 2 - width / 2, vw - width - EDGE));
  const below = vh - rect.bottom;
  if (below >= 160 || below >= rect.top) {
    return { left, top: rect.bottom + 6, maxHeight: below - 6 - EDGE };
  }
  return { left, bottom: vh - rect.top + 6, maxHeight: rect.top - 6 - EDGE };
}

/**
 * A small "i" that explains a zone on hover, focus, or tap. The tip is portalled to the page
 * body so scrolling panels and neighbouring sections can't clip or cover it.
 */
export function InfoTip({ label, children }: InfoTipProps) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);
  const open = (pinned || hovered) && spot !== null;

  function place() {
    if (buttonRef.current) setSpot(spotFor(buttonRef.current));
  }
  function cancelClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }
  function enter() {
    cancelClose();
    place();
    setHovered(true);
  }
  function leave() {
    cancelClose();
    // A short grace period lets the pointer cross from the icon to the tip.
    closeTimer.current = window.setTimeout(() => setHovered(false), 120);
  }

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!pinned && !hovered) return;
    const close = () => {
      setPinned(false);
      setHovered(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || tipRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onScroll = (event: Event) => {
      if (tipRef.current?.contains(event.target as Node)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [pinned, hovered]);

  return (
    <span className="relative inline-flex" onMouseEnter={enter} onMouseLeave={leave}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => {
          place();
          setPinned((value) => !value);
        }}
        onFocus={place}
        className={[
          "inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full text-[0.45rem] leading-none font-semibold",
          "text-[var(--brass)] ring-1 ring-[var(--brass)]/65",
          "hover:bg-[var(--brass)]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--brass)]",
          pinned ? "bg-[var(--brass)]/20" : "",
        ].join(" ")}
      >
        i
      </button>
      {open
        ? createPortal(
            <span
              ref={tipRef}
              id={id}
              role="tooltip"
              onMouseEnter={enter}
              onMouseLeave={leave}
              style={{ ...spot, width: `min(${WIDTH}px, calc(100vw - ${2 * EDGE}px))` }}
              className="fixed z-[90] overflow-y-auto rounded-xl glass-strong px-2.5 py-2 text-left text-[0.7rem] leading-relaxed font-normal tracking-normal text-stone-200 normal-case shadow-xl ring-1 ring-white/10"
            >
              {children}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
