"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { HotseatSession } from "../game/HotseatSession";
import { playerLabel } from "../game/players";
import { copyText } from "../game/share";
import { joinOnlineGame, onlineConfigured, readTicket, useOnlineGame } from "./online-client";
import { currentActor } from "@/lib/game";

const noop = () => () => {};

/** `/online/[id]`: join (if needed), connect, and play one seat. */
export function OnlineGameView({ gameId }: { gameId: string }) {
  // The seat ticket lives in this browser's storage: unknown during server rendering.
  const stored = useSyncExternalStore(
    noop,
    () => JSON.stringify(readTicket(gameId)),
    () => undefined,
  );
  const [joinedToken, setJoinedToken] = useState<string | null>(null);
  const ticket = useMemo(() => (stored ? (JSON.parse(stored) as ReturnType<typeof readTicket>) : null), [stored]);
  const token = joinedToken ?? ticket?.token ?? null;

  if (!onlineConfigured()) return <Message title="Online play isn't set up here" body="No game server is configured for this site." />;
  if (stored === undefined) return <div className="h-dvh bg-[#16120e]" />;
  if (!token) return <JoinScreen gameId={gameId} onJoined={setJoinedToken} />;
  return <Connected gameId={gameId} token={token} />;
}

function Connected({ gameId, token }: { gameId: string; token: string }) {
  const game = useOnlineGame(gameId, token);
  const [copied, setCopied] = useState(false);

  if (!game.state || game.seat === null || !game.settings) {
    if (game.status === "closed") return <Message title="Can't open this game" body={game.error ?? "The connection closed."} />;
    return <Message title="Connecting…" body={game.status === "reconnecting" ? "Trying again…" : "Opening the table."} />;
  }

  const seat = game.seat;
  const other = seat === 0 ? 1 : 0;
  const actor = currentActor(game.state);
  const waitingText = !game.joined[other]
    ? "Waiting for your opponent to join. Send them the invite link."
    : !game.connected[other]
      ? `${playerLabel(actor)} is offline. The game continues when they reconnect.`
      : `Waiting for ${playerLabel(actor)}…`;
  const invite = typeof window === "undefined" ? "" : `${window.location.origin}/online/${gameId}`;

  return (
    <div className="relative">
      <HotseatSession
        remote={{
          seat,
          state: game.state,
          history: game.history,
          settings: game.settings,
          canUndo: game.canUndo,
          send: game.send,
          undo: game.undo,
          waitingText,
        }}
      />
      <div className="pointer-events-none absolute top-12 left-1/2 z-[55] flex -translate-x-1/2 flex-col items-center gap-2">
        {!game.joined[other] ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-full glass-strong px-4 py-2 text-xs shadow-xl ring-1 ring-[var(--brass)]/50">
            <span className="text-stone-200">Invite your opponent:</span>
            <code className="max-w-[16rem] truncate text-stone-400">{invite}</code>
            <button
              type="button"
              onClick={async () => setCopied(await copyText(invite))}
              className="cursor-pointer rounded-full bg-[var(--brass)] px-3 py-1 font-semibold text-stone-950"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        ) : null}
        {game.status !== "open" ? (
          <div className="rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-100 ring-1 ring-amber-400/40">
            Connection lost. Reconnecting…
          </div>
        ) : null}
        {game.error ? (
          <button
            type="button"
            onClick={game.clearError}
            className="pointer-events-auto cursor-pointer rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-100 ring-1 ring-red-400/40"
            title="Dismiss"
          >
            {game.error} ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}

function JoinScreen({ gameId, onJoined }: { gameId: string; onJoined: (token: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Message
      title="You're invited to a game"
      body="Join as Player 2. Your seat is remembered in this browser, so you can close the tab and come back."
    >
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            onJoined((await joinOnlineGame(gameId)).token);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Couldn't join");
            setBusy(false);
          }
        }}
        className="cursor-pointer rounded-full bg-[var(--brass,#c6a56c)] px-6 py-3 text-sm font-semibold text-stone-950 hover:bg-[#d4b57c] disabled:opacity-60"
      >
        {busy ? "Joining…" : "Join game"}
      </button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </Message>
  );
}

function Message({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#16120e] px-6 text-stone-100">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-stone-400">{body}</p>
        {children}
        <Link href="/" className="text-sm text-stone-500 underline hover:text-stone-300">
          Menu
        </Link>
      </div>
    </div>
  );
}
