"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** Chrome, Edge, and Android's install prompt (not in the DOM typings). */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const noSubscribe = () => () => {};

function platform(): "installed" | "ios" | "other" {
  if (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone) {
    return "installed";
  }
  // iPadOS reports itself as a Mac; touch points tell them apart.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

/**
 * "Install app": the browser's own prompt where there is one (Chrome, Edge, Android), and
 * Add to Home Screen steps on iPhone and iPad. Hidden once the game runs as an installed app.
 */
export function InstallAppButton() {
  const where = useSyncExternalStore(noSubscribe, platform, () => null);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const offer = (event: Event) => {
      event.preventDefault(); // Show our button instead of the browser's mini-bar.
      setPrompt(event as InstallPromptEvent);
    };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (where === null || where === "installed") return null;
  if (where !== "ios" && !prompt) return null;

  return (
    <span className="relative">
      <button
        type="button"
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            await prompt.userChoice;
            setPrompt(null);
          } else {
            setShowSteps((open) => !open);
          }
        }}
        aria-expanded={prompt ? undefined : showSteps}
        title="Install Pax Corruption as an app: it opens full screen and plays offline"
        className="cursor-pointer rounded-full px-3 py-1.5 font-medium whitespace-nowrap text-stone-200 transition hover:bg-white/[0.06] hover:text-stone-50"
      >
        Install app
      </button>
      {showSteps ? (
        <span
          role="note"
          className="absolute top-full right-0 z-20 mt-2 block w-64 rounded-xl border border-white/10 bg-[#11151c] p-3 text-left text-xs leading-relaxed text-stone-300 shadow-2xl"
        >
          In Safari, tap <b className="text-stone-100">Share</b> (the square with an arrow), then{" "}
          <b className="text-stone-100">Add to Home Screen</b>. The game then opens full screen and plays offline,
          except online games.
        </span>
      ) : null}
    </span>
  );
}
