"use client";

import { useState } from "react";
import { Portrait } from "./Portrait";
import { motionScale } from "./settings";
import type { AiVoice } from "@/lib/game/ai";
import type { PlayerId } from "@/lib/game";

/**
 * What the table's moments share (TableMoment.tsx): when they play, how long they wait to be
 * read, and the countdown bar and hint shown while they wait.
 */

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Moments play unless Motion is off or the system asks for reduced motion. */
export function momentsOn(): boolean {
  return motionScale() > 0 && !reducedMotion();
}

/** The animation speed setting, read once when the moment opens. */
export function useScale(): number {
  const [scale] = useState(() => motionScale() || 1);
  return scale;
}

/**
 * How long a screen stays up once its text is in: a moment to find it, then about 240 words a
 * minute. The animation speed setting doesn't shorten it (a click moves on sooner).
 */
export function readingMs(...texts: (string | null)[]): number {
  const words = texts.join(" ").split(/\s+/).filter(Boolean).length;
  return 1200 + words * 250;
}

/** How long a moment fades out for. */
export const LEAVE_MS = 450;

/** A thin bar along the screen's bottom edge that runs down while the screen waits. */
export function CountdownBar({
  delayMs,
  durationMs,
  inset,
  tone = "bg-[var(--election)]/70",
}: {
  delayMs: number;
  durationMs: number;
  inset: string;
  /** The bar's color class. */
  tone?: string;
}) {
  return (
    <div aria-hidden className={`absolute bottom-0 h-0.5 overflow-hidden ${inset}`}>
      <div className={`moment-timer h-full ${tone}`} style={{ animationDelay: `${delayMs}ms`, animationDuration: `${durationMs}ms` }} />
    </div>
  );
}

/** A computer opponent who speaks at turning points (Time Traveller Ty): who, and in which seat. */
export type MomentVoice = { seat: PlayerId; name: string; portrait: string; color: string; lines: AiVoice };

/** One of their lines, picked by the moment so it stays the same while the moment plays. */
export function voiceLine(lines: readonly string[], id: number): string {
  return lines[id % lines.length]!;
}

/** Their line, beside their portrait. `delayMs`: when it comes in. */
export function VoiceLine({ voice, line, delayMs, className = "" }: { voice: MomentVoice; line: string; delayMs: number; className?: string }) {
  return (
    <p className={`moment-voice flex items-center justify-center gap-2.5 ${className}`} style={{ animationDelay: `${delayMs}ms` }}>
      <Portrait src={voice.portrait} color={voice.color} size="sm" />
      <span className="text-left text-sm leading-snug italic sm:text-base" style={{ color: `color-mix(in srgb, ${voice.color} 45%, #ffe3da)` }}>
        <span className="sr-only">{voice.name}: </span>“{line}”
      </span>
    </p>
  );
}

/** The way to move on sooner. */
export function ContinueHint({ delayMs, className = "" }: { delayMs: number; className?: string }) {
  return (
    <p className={`moment-hint text-[0.65rem] text-stone-500 ${className}`} style={{ animationDelay: `${delayMs}ms` }}>
      Click or tap to continue
    </p>
  );
}
