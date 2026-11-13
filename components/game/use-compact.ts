"use client";

import { useSyncExternalStore } from "react";

/** Narrow screens (below Tailwind's `lg`) and short ones (phones held sideways) get the phone layout. */
export const COMPACT_QUERY = "(max-width: 1023px), (max-height: 540px)";
/** A phone held sideways: too short to stack, so the phone layout goes side by side. */
export const LANDSCAPE_QUERY = "(orientation: landscape) and (max-height: 540px)";

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True on phone-sized screens. False during server rendering (desktop first). */
export function useCompact(): boolean {
  return useMediaQuery(COMPACT_QUERY);
}

/** True for a phone in landscape. */
export function useCompactLandscape(): boolean {
  return useMediaQuery(LANDSCAPE_QUERY);
}
