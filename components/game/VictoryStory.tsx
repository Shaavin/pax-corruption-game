"use client";

import { Felipa } from "next/font/google";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { KIND_LABEL } from "./GameOverOverlay";
import { usePlayerLabel } from "./players";
import { getSettings } from "./settings";
import type { Victory, VictoryKindId } from "@/lib/game";

/** The rulebooks set these passages in a calligraphic hand; this is the nearest web font. */
const calligraphy = Felipa({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });

type Future = {
  title: string;
  /** The band's passage, word for word. */
  text: string;
  /** The band's color. */
  color: string;
  /** The scene (prepared by scripts/make-victory-art.py), and where the camera pulls back from. */
  art: string;
  focus: string;
};

const art = (kind: VictoryKindId) => `/art/victory/${kind}.webp`;

/**
 * The "Gallery of the Future": the future each victory brings, word for word from the rulebooks
 * (base rulebook p. 11; Legacy & Diplomacy p. 7), with the color of its band on that page. Like
 * the bands, each scene is a photograph washed in that color.
 */
export const FUTURES: Record<VictoryKindId, Future> = {
  civil: {
    title: "A Democratic Future",
    text: "With a Civil Victory, both sides of the Vitalic Union have now realized that the only way forward is through cooperation. They agree to lead together and ensure citizens a democratic future.",
    color: "#1c595d",
    art: art("civil"),
    focus: "56% 42%",
  },
  political: {
    title: "An Autocratic Future",
    text: "With a Political Victory, the party has proven its capability to lead the Union by themselves. Opposition is mostly marginalized with little to no chance of being elected into power.",
    color: "#954698",
    art: art("political"),
    focus: "50% 38%",
  },
  cultural: {
    title: "An Enlightened Future",
    text: "With a Cultural Victory, new infrastructures & programs have inspired the public, who is empowered to build from monumental improvements into transcending arts & innovations.",
    color: "#ad3265",
    art: art("cultural"),
    focus: "50% 58%",
  },
  diplomatic: {
    title: "A Cosmopolitan Future",
    text: "With a Diplomatic Victory, the World Union decides to be built in Vitalic Union for neutrality, which brings in a large influx of international talents that help shape a stable & peaceful future.",
    color: "#499150",
    art: art("diplomatic"),
    focus: "58% 42%",
  },
  military: {
    title: "A Dynastic Future",
    text: "With a Military Victory, choirs are sang as partner warlords welcome the party leader into power. Little is realized about the dangerous precedence it has set for fellow ambitious militia.",
    color: "#b53d24",
    art: art("military"),
    focus: "50% 34%",
  },
  popularity: {
    title: "A Disintegrated Future",
    text: "With a Popularity Victory, the idealists see their picture of a joint peaceful Union falling apart into fragments of independent republics lying across the continent of Vitali.",
    color: "#824e1f",
    art: art("popularity"),
    focus: "64% 52%",
  },
  ideological: {
    title: "A Police State Future",
    text: "With an Ideological Victory, heretics to the dominant ideology are controlled or exiled by the state-run brotherhood watch.",
    color: "#174870",
    art: art("ideological"),
    focus: "58% 34%",
  },
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
 * The moment of victory: the victory's scene, tinted like its band in the rulebook, slowly pulls
 * back while the passage on its future is typed out. Then the results.
 */
export function VictoryStory({ victory, onDone }: { victory: Victory; onDone: () => void }) {
  const future = FUTURES[victory.kind];
  const playerLabel = usePlayerLabel();
  const [still] = useState(holdStill);
  const [typed, setTyped] = useState(() => (still ? future.text.length : 0));
  const [artReady, setArtReady] = useState(false);
  const done = typed >= future.text.length;
  const resultsRef = useRef<HTMLButtonElement>(null);
  // An image already in the cache can finish loading before React listens for it.
  const catchLoadedArt = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setArtReady(true);
  }, []);

  // One letter at a time, with a breath after each comma and sentence.
  useEffect(() => {
    if (typed >= future.text.length) return;
    const previous = future.text[typed - 1];
    const delay = typed === 0 ? TYPE_START_MS : previous === "." ? 420 : previous === "," ? 200 : LETTER_MS;
    const pace = getSettings().motion === "fast" ? 0.6 : 1;
    const timer = window.setTimeout(() => setTyped((count) => count + 1), delay * pace);
    return () => window.clearTimeout(timer);
  }, [typed, future.text]);

  useEffect(() => {
    if (done) resultsRef.current?.focus({ preventScroll: true });
  }, [done]);

  // Escape skips to the results; Enter or Space finishes the passage at once.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDone();
      else if ((event.key === "Enter" || event.key === " ") && typed < future.text.length) {
        event.preventDefault();
        setTyped(future.text.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone, typed, future.text.length]);

  const finishTyping = () => {
    if (!done) setTyped(future.text.length);
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
      {/* Tinted like the victory's band in the rulebook. */}
      <div aria-hidden className="absolute inset-0 bg-[var(--future)] opacity-75 mix-blend-color" />
      <div aria-hidden className="absolute inset-0 bg-[var(--future)] opacity-45 mix-blend-multiply" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, color-mix(in srgb, ${future.color} 45%, black) 0%, color-mix(in srgb, ${future.color} 40%, transparent) 38%, transparent 68%)`,
        }}
      />
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
        <div className="max-w-3xl">
          <p className="victory-rise text-[0.7rem] font-semibold tracking-[0.22em] text-white/80 uppercase sm:text-xs" style={{ animationDelay: "500ms" }}>
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
            {future.text}
          </p>
          {/* The full passage holds the space, so nothing moves while it types. */}
          <p
            aria-hidden
            className={`${calligraphy.className} relative mt-4 text-[1.45rem] leading-snug text-white/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)] sm:mt-5 sm:text-[2.1rem]`}
          >
            <span className="invisible">{future.text}</span>
            <span className="absolute inset-0">
              {future.text.slice(0, typed)}
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
