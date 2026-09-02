import type { Metadata } from "next";
import { HotseatSession } from "@/components/game/HotseatSession";
import { randomUint32 } from "@/lib/game/rng";

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
  const raw = params.seed;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const seed =
    value !== undefined && /^\d+$/.test(value)
      ? Number(value) >>> 0
      : randomUint32();

  return <HotseatSession seed={seed} />;
}
