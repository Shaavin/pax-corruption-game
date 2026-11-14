"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { HomeLauncher } from "../home/HomeLauncher";
import { fetchGameInfo, forgetTicket, listTicketGames, onlineConfigured } from "./online-client";
import { PageShell } from "./PageShell";
import { describeSettings, type GameInfoResponse } from "@/lib/online/protocol";

/** `/online`: start a game (same launcher as the home page) and get back to this device's games. */
export function OnlineLobby() {
  return (
    <PageShell>
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Play online</h1>
        <p className="mt-2 text-sm text-stone-400">
          Start a game, then send the link to your opponent. Each of you plays on your own device, and your hand stays
          private.
        </p>
      </header>
      <HomeLauncher onlineOnly />
      {onlineConfigured() ? <MyGames /> : null}
      <Link href="/" className="text-center text-sm text-stone-400 underline-offset-4 hover:text-stone-200 hover:underline">
        Back to the home page
      </Link>
    </PageShell>
  );
}

const ticketListeners = new Set<() => void>();

/** Games this browser has a seat in, to get back to them. */
function MyGames() {
  const raw = useSyncExternalStore(
    (onChange) => {
      ticketListeners.add(onChange);
      return () => ticketListeners.delete(onChange);
    },
    () => listTicketGames().join(","),
    () => "",
  );
  const games = raw ? raw.split(",") : [];
  if (games.length === 0) return null;
  return (
    <section aria-labelledby="my-games" className="flex flex-col gap-2">
      <h2 id="my-games" className="text-[0.7rem] font-semibold tracking-[0.14em] text-stone-500 uppercase">
        Your games on this device
      </h2>
      <ul className="flex flex-col gap-1.5">
        {games.map((gameId) => (
          <MyGame key={gameId} gameId={gameId} />
        ))}
      </ul>
    </section>
  );
}

function MyGame({ gameId }: { gameId: string }) {
  const [info, setInfo] = useState<GameInfoResponse | "gone" | null>(null);
  useEffect(() => {
    let live = true;
    fetchGameInfo(gameId)
      .then((result) => live && setInfo(result))
      .catch(() => live && setInfo("gone"));
    return () => {
      live = false;
    };
  }, [gameId]);
  const forget = () => {
    forgetTicket(gameId);
    ticketListeners.forEach((listener) => listener());
  };
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0d1117]/80 px-4 py-3 text-sm backdrop-blur">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-stone-400">{gameId}</p>
        <p className="truncate text-xs text-stone-300">
          {info === null
            ? "Loading…"
            : info === "gone"
              ? "This game has ended or expired."
              : `${describeSettings(info.settings).join(" · ")}${info.open ? " · waiting for an opponent" : ""}`}
        </p>
      </div>
      {info === "gone" ? null : (
        <Link href={`/online/${gameId}`} className="rounded-full bg-[var(--brass,#c6a56c)] px-3 py-1 text-xs font-semibold text-stone-950">
          Open
        </Link>
      )}
      <button type="button" onClick={forget} className="cursor-pointer text-xs text-stone-500 hover:text-stone-300" title="Remove from this list">
        Forget
      </button>
    </li>
  );
}
