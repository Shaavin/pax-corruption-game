"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type InfoTipProps = {
  label: string;
  children: ReactNode;
};

export function InfoTip({ label, children }: InfoTipProps) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;

  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setPinned(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  return (
    <span
      ref={rootRef}
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setPinned((value) => !value)}
        className={[
          "inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full text-[0.45rem] leading-none font-semibold",
          "text-[var(--brass)] ring-1 ring-[var(--brass)]/65",
          "hover:bg-[var(--brass)]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--brass)]",
          pinned ? "bg-[var(--brass)]/20" : "",
        ].join(" ")}
      >
        i
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute top-[calc(100%+6px)] left-1/2 z-[60] w-52 -translate-x-1/2 rounded-md bg-[#221c16] px-2.5 py-2 text-left text-[0.7rem] leading-relaxed font-normal tracking-normal text-stone-200 shadow-xl ring-1 ring-white/10 normal-case"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
