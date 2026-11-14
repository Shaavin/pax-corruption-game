"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { rememberedNames, rememberNames } from "../game/players";
import { createOnlineGame, fetchGameInfo, forgetTicket, listTicketGames, onlineConfigured } from "./online-client";
import { describeSettings, type GameInfoResponse } from "@/lib/online/protocol";
import { cleanName, MAX_NAME_LENGTH, nameProblem } from "@/lib/game/names";
import { GAME_MODES, isGameMode } from "@/lib/game/setup";

/** `/online`: start a game and get a link to send the other player. */
export function OnlineLobby() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const mode = String(form.get("mode"));
    const problem = nameProblem(form.get("name"));
    if (problem) {
      setError(problem);
      return;
    }
    const name = cleanName(form.get("name"));
    if (name) rememberNames([name, rememberedNames()[1]]);
    setBusy(true);
    setError(null);
    try {
      const created = await createOnlineGame({
        mode: isGameMode(mode) ? mode : "standard",
        expansion: form.get("expansion") === "1",
        foreignInfluence: form.get("fi") === "1",
        ...(name ? { name } : {}),
      });
      router.push(`/online/${created.gameId}`);
    } catch (caught) {
      // A network failure surfaces as a TypeError ("Failed to fetch"); say what it means.
      setError(
        caught instanceof TypeError || !(caught instanceof Error)
          ? "Couldn't reach the game server. Check your connection and try again."
          : caught.message,
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#16120e] px-6 py-10 text-stone-100">
      <main className="flex w-full max-w-md flex-col gap-6">
        <header className="text-center">
          <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--brass,#c6a56c)] uppercase">Pax Corruption</p>
          <h1 className="mt-1 text-3xl font-semibold">Play online</h1>
          <p className="mt-2 text-sm text-stone-400">
            Start a game, then send the link to your opponent. Each of you plays on your own device; your hand stays
            private.
          </p>
        </header>

        {!onlineConfigured() ? (
          <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/30">
            Online play isn&apos;t set up on this site yet (no game server configured).
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="text"
              name="name"
              aria-label="Your name (optional)"
              placeholder="Your name (optional)"
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              spellCheck={false}
              className="rounded-xl bg-white/[0.04] px-3.5 py-3 text-sm ring-1 ring-white/12 placeholder:text-stone-500 focus:ring-[var(--brass,#c6a56c)] focus:outline-none"
            />
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="sr-only">Draw-deck mode</legend>
              {GAME_MODES.map((mode, index) => (
                <label
                  key={mode.id}
                  className="flex h-full cursor-pointer flex-col rounded-xl bg-white/[0.04] px-3.5 py-3 ring-1 ring-white/12 transition-colors hover:bg-white/[0.08] has-[:checked]:bg-[var(--brass,#c6a56c)] has-[:checked]:text-stone-950 has-[:checked]:ring-transparent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-white"
                >
                  <input type="radio" name="mode" value={mode.id} defaultChecked={index === 0} className="sr-only" />
                  <span className="text-sm font-semibold">{mode.name}</span>
                  <span className="mt-0.5 text-xs opacity-80">{mode.blurb}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="flex flex-col gap-1.5 rounded-xl bg-white/[0.03] px-3.5 py-3 text-sm ring-1 ring-white/10">
              <legend className="sr-only">Expansion</legend>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" name="expansion" value="1" className="accent-[var(--brass,#c6a56c)]" />
                <span className="font-semibold">Legacy &amp; Diplomacy</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 pl-6">
                <input type="checkbox" name="fi" value="1" className="accent-[var(--brass,#c6a56c)]" />
                <span className="text-stone-300">Foreign Influence variant</span>
              </label>
            </fieldset>
            <button
              type="submit"
              disabled={busy}
              className="cursor-pointer rounded-full bg-[var(--brass,#c6a56c)] px-6 py-3 text-sm font-semibold text-stone-950 hover:bg-[#d4b57c] disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create game"}
            </button>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </form>
        )}

        {onlineConfigured() ? <MyGames /> : null}

        <Link href="/" className="text-center text-sm text-stone-400 underline hover:text-stone-200">
          Back to the menu
        </Link>
      </main>
    </div>
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
    <li className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-sm ring-1 ring-white/10">
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
