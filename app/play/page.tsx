import type { Metadata } from "next";
import { HotseatSession } from "@/components/game/HotseatSession";
import { ResumeGame } from "@/components/game/ResumeGame";
import { randomUint32 } from "@/lib/game/rng";
import { cleanName } from "@/lib/game/names";
import { isGameMode } from "@/lib/game/setup";
import { aiPersona, isAiLevel } from "@/lib/game/ai";
import { GameMode } from "@/lib/game/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Game table",
  // Each table is a fresh random game: nothing for search to index.
  robots: { index: false, follow: true },
};

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.resume !== undefined) return <ResumeGame />;
  const raw = params.seed;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const seed =
    value !== undefined && /^\d+$/.test(value)
      ? Number(value) >>> 0
      : randomUint32();

  const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const mode = isGameMode(rawMode) ? rawMode : GameMode.Standard;

  const flag = (key: string) => {
    const raw = params[key];
    return (Array.isArray(raw) ? raw[0] : raw) === "1";
  };
  const expansion = flag("expansion");

  const name = (key: string) => cleanName(Array.isArray(params[key]) ? params[key]![0] : params[key]);
  // ?ai=easy|normal: the computer takes Player 2's seat; you're Player 1.
  const rawAi = Array.isArray(params.ai) ? params.ai[0] : params.ai;
  const ai = isAiLevel(rawAi) ? ({ seat: 1, level: rawAi } as const) : undefined;
  return (
    <HotseatSession
      seed={seed}
      mode={mode}
      expansion={expansion}
      foreignInfluence={expansion && flag("fi")}
      names={[name("n1"), ai ? aiPersona(ai.level).name : name("n2")]}
      ai={ai}
    />
  );
}
