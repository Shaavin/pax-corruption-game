import type { Metadata } from "next";
import { HotseatSession } from "@/components/game/HotseatSession";
import { ResumeGame } from "@/components/game/ResumeGame";
import { randomUint32 } from "@/lib/game/rng";
import { isGameMode } from "@/lib/game/setup";
import { GameMode } from "@/lib/game/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Table",
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

  return <HotseatSession seed={seed} mode={mode} expansion={expansion} foreignInfluence={expansion && flag("fi")} />;
}
