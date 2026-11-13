"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HotseatSession } from "./HotseatSession";
import { parseSavedGame, useSavedGameRaw } from "./saved-game";
import { replayRecord, ReplayError, type GameRecord } from "@/lib/game/record";

type Loaded =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "ok"; record: GameRecord }
  | { kind: "error"; message: string };

/** `/play?resume=1`: rebuild the saved game by replaying its actions. */
export function ResumeGame() {
  const raw = useSavedGameRaw();
  // Read the save once; later saves come from this session itself.
  const [frozen, setFrozen] = useState<string | null | undefined>(undefined);
  if (frozen === undefined && raw !== undefined) setFrozen(raw);

  const loaded = useMemo<Loaded>(() => {
    if (frozen === undefined) return { kind: "loading" };
    const saved = parseSavedGame(frozen);
    if (!saved) return { kind: "none" };
    try {
      replayRecord(saved.record);
      return { kind: "ok", record: saved.record };
    } catch (error) {
      return {
        kind: "error",
        message:
          error instanceof ReplayError
            ? `Seed ${saved.record.seed}: ${error.message}`
            : `Seed ${saved.record.seed}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }, [frozen]);

  if (loaded.kind === "ok") return <HotseatSession record={loaded.record} />;
  if (loaded.kind === "loading") return <div className="table-shell h-dvh w-full" />;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#16120e] px-6 text-stone-100">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">
          {loaded.kind === "none" ? "No saved game" : "This saved game can't be loaded"}
        </h1>
        {loaded.kind === "error" ? (
          <p className="mt-3 text-sm break-words text-stone-400">{loaded.message}</p>
        ) : (
          <p className="mt-3 text-sm text-stone-400">There is no game in progress in this browser.</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <a
            href="/play"
            className="rounded-full bg-[var(--brass,#c6a56c)] px-5 py-2.5 text-sm font-semibold text-stone-950 hover:brightness-110"
          >
            New game
          </a>
          <Link href="/" className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/8">
            Menu
          </Link>
        </div>
      </div>
    </div>
  );
}
