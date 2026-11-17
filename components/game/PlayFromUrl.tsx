"use client";

import { useState, useSyncExternalStore } from "react";
import { HotseatSession } from "./HotseatSession";
import { ResumeGame } from "./ResumeGame";
import { aiPersona, isAiLevel } from "@/lib/game/ai";
import { cleanName } from "@/lib/game/names";
import { randomUint32 } from "@/lib/game/rng";
import { isGameMode } from "@/lib/game/setup";
import { GameMode } from "@/lib/game/types";

const noSubscribe = () => () => {};

/**
 * `/play`, set up in the browser from the address: the page itself is the same for every
 * game, so the installed app can start any game offline from one cached copy.
 *
 * `?seed=` (digits) replays a seed; `?mode=`, `?expansion=1`, `?fi=1` pick the setup;
 * `?n1=` / `?n2=` name the players; `?ai=easy|normal|hard` puts the computer in seat 2;
 * `?resume` reopens the game saved in this browser.
 */
export function PlayFromUrl() {
  // Null while rendering on the server (and the first client pass), then the real query.
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => null);
  const [randomSeed] = useState(randomUint32);
  if (search === null) return <div className="min-h-dvh bg-[#0a0c10]" aria-busy="true" />;

  const params = new URLSearchParams(search);
  if (params.has("resume")) return <ResumeGame />;

  const rawSeed = params.get("seed");
  const seed = rawSeed !== null && /^\d+$/.test(rawSeed) ? Number(rawSeed) >>> 0 : randomSeed;
  const rawMode = params.get("mode");
  const mode = isGameMode(rawMode) ? rawMode : GameMode.Standard;
  const expansion = params.get("expansion") === "1";
  const rawAi = params.get("ai");
  // The computer takes Player 2's seat; you're Player 1.
  const ai = isAiLevel(rawAi) ? ({ seat: 1, level: rawAi } as const) : undefined;

  return (
    <HotseatSession
      seed={seed}
      mode={mode}
      expansion={expansion}
      foreignInfluence={expansion && params.get("fi") === "1"}
      names={[cleanName(params.get("n1")), ai ? aiPersona(ai.level).name : cleanName(params.get("n2"))]}
      ai={ai}
    />
  );
}
