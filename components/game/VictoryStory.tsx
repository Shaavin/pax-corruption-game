"use client";

import { Fondamento } from "next/font/google";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { KIND_LABEL } from "./GameOverOverlay";
import { usePlayerLabel } from "./players";
import { getSettings } from "./settings";
import type { Victory, VictoryKindId } from "@/lib/game";

/** The rulebooks set these passages in Kokonor's calligraphic italic (a Mac font); this is the nearest web font. */
const calligraphy = Fondamento({ weight: "400", style: "italic", subsets: ["latin"], preload: false, display: "swap" });

type Future = {
  title: string;
  /** The band's color. */
  color: string;
  /** The scene (Joe's band art, prepared by scripts/make-victory-art.py), and where the camera pulls back from. */
  art: string;
  focus: string;
};

const art = (kind: VictoryKindId) => `/art/victory/${kind}.webp`;

/**
 * The "Gallery of the Future": each victory's future, titled and colored like its band in the
 * rulebooks (base rulebook p. 11; Legacy & Diplomacy p. 7), over the band's picture. The passage
 * typed under it names this game's winner (`victoryPassage`, lib/game/epilogue.ts).
 */
export const FUTURES: Record<VictoryKindId, Future> = {
  civil: { title: "A Democratic Future", color: "#1c595d", art: art("civil"), focus: "62% 42%" },
  political: { title: "An Autocratic Future", color: "#954698", art: art("political"), focus: "64% 36%" },
  cultural: { title: "An Enlightened Future", color: "#ad3265", art: art("cultural"), focus: "50% 42%" },
  diplomatic: { title: "A Cosmopolitan Future", color: "#499150", art: art("diplomatic"), focus: "50% 55%" },
  military: { title: "A Dynastic Future", color: "#b53d24", art: art("military"), focus: "56% 34%" },
  popularity: { title: "A Disintegrated Future", color: "#824e1f", art: art("popularity"), focus: "58% 34%" },
  ideological: { title: "A Censored Future", color: "#174870", art: art("ideological"), focus: "50% 42%" },
};

/** Before the first letter: the scene fades in and the title rises. */
const TYPE_START_MS = 1900;
const LETTER_MS = 34;

/** No pan and no typing: reduced motion, or animations switched off in Settings. */
function holdStill(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || getSettings().motion === "off";
}

/**
 * The moment of victory: the victory's scene, colored like its band in the rulebook, slowly pulls
 * back while the passage on its future is typed out. Then the results.
 */
export function VictoryStory({ victory, text, onDone }: { victory: Victory; text: string; onDone: () => void }) {
  const future = FUTURES[victory.kind];
  const playerLabel = usePlayerLabel();
  const [still] = useState(holdStill);
  const [typed, setTyped] = useState(() => (still ? text.length : 0));
  const [artReady, setArtReady] = useState(false);
  const done = typed >= text.length;
  const resultsRef = useRef<HTMLButtonElement>(null);
  // An image already in the cache can finish loading before React listens for it.
  const catchLoadedArt = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setArtReady(true);
  }, []);

  // One letter at a time, with a breath after each comma and sentence.
  useEffect(() => {
    if (typed >= text.length) return;
    const previous = text[typed - 1];
    const delay = typed === 0 ? TYPE_START_MS : previous === "." ? 420 : previous === "," ? 200 : LETTER_MS;
    const pace = getSettings().motion === "fast" ? 0.6 : 1;
    const timer = window.setTimeout(() => setTyped((count) => count + 1), delay * pace);
    return () => window.clearTimeout(timer);
  }, [typed, text]);

  useEffect(() => {
    if (done) resultsRef.current?.focus({ preventScroll: true });
  }, [done]);

  // Escape skips to the results; Enter or Space finishes the passage at once.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDone();
      else if ((event.key === "Enter" || event.key === " ") && typed < text.length) {
        event.preventDefault();
        setTyped(text.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone, typed, text.length]);

  const finishTyping = () => {
    if (!done) setTyped(text.length);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-story-title"
      aria-describedby="victory-story-text"
      data-modal
      data-victory-story={victory.kind}
      onClick={finishTyping}
      className={["fixed inset-0 z-[75] overflow-hidden bg-black text-white select-none", still ? "victory-still" : ""].join(" ")}
      style={{ "--future": future.color } as CSSProperties}
    >
      {/* The scene, pulling back from its focus. */}
      <div className="victory-pan absolute inset-0" style={{ transformOrigin: future.focus }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- one full-screen scene, already sized and compressed */}
        <img
          ref={catchLoadedArt}
          src={future.art}
          alt=""
          draggable={false}
          onLoad={() => setArtReady(true)}
          style={{ objectPosition: future.focus }}
          className={["h-full w-full object-cover transition-opacity duration-[1600ms]", artReady ? "opacity-100" : "opacity-0"].join(" ")}
        />
      </div>
      {/* The art already carries the band's color; this deepens it under the passage. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, color-mix(in srgb, ${future.color} 40%, black) 0%, color-mix(in srgb, color-mix(in srgb, ${future.color} 55%, black) 70%, transparent) 40%, transparent 72%)`,
        }}
      />
      {/* A little more shade on the side the passage sits, for the lighter scenes. */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/35 via-black/10 via-55% to-transparent" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDone();
        }}
        className="absolute top-3 right-3 z-10 cursor-pointer rounded-full bg-black/35 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white/80 ring-1 ring-white/25 backdrop-blur-sm hover:bg-black/55 hover:text-white sm:top-5 sm:right-5"
      >
        Skip <span aria-hidden>»</span>
      </button>

      <div className="absolute inset-x-0 bottom-0 px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:px-12 sm:pb-12 lg:px-20 lg:pb-16">
        <div className="max-w-[56rem]">
          <p
            className="victory-rise text-[0.7rem] font-semibold tracking-[0.22em] text-white/85 uppercase drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)] sm:text-xs"
            style={{ animationDelay: "500ms" }}
          >
            <span className="text-[var(--brass)]">★</span> {playerLabel(victory.player)} wins · {KIND_LABEL[victory.kind]}
          </p>
          <h2
            id="victory-story-title"
            className="victory-rise mt-2 text-4xl leading-tight font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)] sm:text-6xl"
            style={{ animationDelay: "1000ms" }}
          >
            {future.title}
          </h2>
          <p id="victory-story-text" className="sr-only">
            {text}
          </p>
          {/* The full passage holds the space, so nothing moves while it types. */}
          <p
            aria-hidden
            className={`${calligraphy.className} relative mt-4 text-[1.45rem] leading-snug text-white/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)] sm:mt-5 sm:text-[2.1rem]`}
          >
            <span className="invisible">{text}</span>
            <span className="absolute inset-0">
              {text.slice(0, typed)}
              {done ? null : <span className="victory-caret" />}
            </span>
          </p>
          <div className="relative mt-6 flex items-center sm:mt-8">
            <button
              ref={resultsRef}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDone();
              }}
              className={[
                "cursor-pointer rounded-xl bg-[var(--act)] px-5 py-2.5 text-sm font-semibold text-stone-950 shadow-lg hover:brightness-110 sm:text-base",
                done ? "rise-in" : "invisible",
              ].join(" ")}
            >
              See the results <span aria-hidden>→</span>
            </button>
            {done ? null : (
              <span className="absolute left-0 text-xs text-white/55">
                <span className="pointer-fine:hidden">Tap</span>
                <span className="hidden pointer-fine:inline">Click</span> to show it all
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
