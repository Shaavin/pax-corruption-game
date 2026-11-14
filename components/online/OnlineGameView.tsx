"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HotseatSession } from "../game/HotseatSession";
import { playerLabel, rememberedNames, rememberNames } from "../game/players";
import { cleanName, MAX_NAME_LENGTH, nameProblem } from "@/lib/game/names";
import { copyText } from "../game/share";
import {
  fetchGameInfo,
  joinOnlineGame,
  onlineConfigured,
  readRejoinHash,
  readTicket,
  rejoinLink,
  saveTicket,
  useOnlineGame,
} from "./online-client";
import { playTurnChime, readTurnAlerts, writeTurnAlerts } from "./turn-alerts";
import { describeSettings, type GameInfoResponse, type GameSettings } from "@/lib/online/protocol";
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
  // A private rejoin link (…#seat=1.token) seats this browser; keep it, then clear it from the address bar.
  const [claim] = useState(readRejoinHash);
  useEffect(() => {
    if (!claim) return;
    saveTicket(gameId, claim);
    window.history.replaceState(null, "", window.location.pathname);
  }, [claim, gameId]);
  const ticket = useMemo(() => (stored ? (JSON.parse(stored) as ReturnType<typeof readTicket>) : null), [stored]);
  const token = joinedToken ?? claim?.token ?? ticket?.token ?? null;

  if (!onlineConfigured()) return <Message title="Online play isn't set up here" body="No game server is configured for this site." />;
  if (stored === undefined) return <div className="h-dvh bg-[#16120e]" />;
  if (!token) return <JoinScreen gameId={gameId} onJoined={setJoinedToken} />;
  return <Connected gameId={gameId} token={token} />;
}

function Connected({ gameId, token }: { gameId: string; token: string }) {
  const game = useOnlineGame(gameId, token);
  const [copied, setCopied] = useState(false);
  const [settingsSeen, setSettingsSeen] = useState(false);
  const [alerts, setAlerts] = useState(readTurnAlerts);
  const [wantRematch, setWantRematch] = useState(false);
  const router = useRouter();

  const opponentSeat = game.seat === 0 ? 1 : 0;
  const myTurn = Boolean(
    game.state && game.seat !== null && !game.state.victory && game.joined[opponentSeat] && currentActor(game.state) === game.seat,
  );
  // Your turn: say so in the tab title, and (if turned on) chime and notify while the tab is in the background.
  useEffect(() => {
    if (!myTurn) return;
    const previous = document.title;
    document.title = "● Your turn · Pax Corruption";
    if (alerts && document.hidden) {
      playTurnChime();
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Your turn in Pax Corruption", { body: "Your opponent has moved.", tag: `pax-${gameId}` });
        }
      } catch {
        // Some browsers only allow notifications from a service worker; the title and chime still work.
      }
    }
    return () => {
      document.title = previous;
    };
  }, [myTurn, alerts, gameId]);

  // Rematch: whoever asked for it goes straight there once the server has made it.
  useEffect(() => {
    if (!wantRematch || !game.rematch || game.seat === null) return;
    saveTicket(game.rematch.gameId, { seat: game.seat, token: game.rematch.token });
    router.push(`/online/${game.rematch.gameId}`);
  }, [wantRematch, game.rematch, game.seat, router]);

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
      ? `${playerLabel(actor, game.names)} is offline. The game continues when they reconnect.`
      : `Waiting for ${playerLabel(actor, game.names)}…`;
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
          names: game.names,
          rematch: game.state.victory
            ? game.rematch
              ? {
                  label: game.rematch.by === seat ? "Go to the rematch" : "Join the rematch",
                  note: game.rematch.by === seat ? undefined : `${playerLabel(other, game.names)} wants a rematch!`,
                  onClick: () => setWantRematch(true),
                }
              : { label: wantRematch ? "Starting…" : "Rematch", onClick: () => (setWantRematch(true), game.requestRematch()) }
            : null,
          menu: [
            {
              label: alerts ? "Turn alerts: on" : "Turn alerts: off",
              title: "A chime and a notification when it's your turn while this tab is in the background",
              onClick: async () => {
                if (alerts) {
                  writeTurnAlerts(false);
                  setAlerts(false);
                  return "Turn alerts are off.";
                }
                writeTurnAlerts(true);
                setAlerts(true);
                playTurnChime(true);
                let permission: string = "unsupported";
                try {
                  if ("Notification" in window) permission = await Notification.requestPermission();
                } catch {
                  // Unsupported: chime and title only.
                }
                return permission === "granted"
                  ? "Turn alerts are on: a chime and a notification when it's your turn."
                  : "Turn alerts are on: a chime when it's your turn (notifications aren't allowed in this browser).";
              },
            },
            {
              label: "Play on another device",
              title: "Copy a private link that opens your seat elsewhere",
              onClick: async () =>
                (await copyText(rejoinLink(gameId, seat, token)))
                  ? "Private link copied. Open it on your other device. Anyone with it can play your seat, so keep it to yourself."
                  : "Couldn't copy the link.",
            },
          ],
        }}
      />
      <div className="pointer-events-none absolute top-12 left-1/2 z-[55] flex -translate-x-1/2 flex-col items-center gap-2">
        {!settingsSeen ? (
          <button
            type="button"
            onClick={() => setSettingsSeen(true)}
            title="Dismiss"
            className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full glass-strong px-3 py-1.5 text-xs shadow-xl ring-1 ring-white/10"
          >
            <span className="text-stone-400">Playing</span>
            <SettingsChips settings={game.settings} />
            <span aria-hidden className="text-stone-500">✕</span>
          </button>
        ) : null}
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

function SettingsChips({ settings }: { settings: GameSettings }) {
  return (
    <span className="flex flex-wrap items-center justify-center gap-1.5">
      {describeSettings(settings).map((label) => (
        <span key={label} className="rounded-full bg-[var(--brass,#c6a56c)]/15 px-2 py-0.5 font-semibold text-[var(--brass,#c6a56c)]">
          {label}
        </span>
      ))}
    </span>
  );
}

function JoinScreen({ gameId, onJoined }: { gameId: string; onJoined: (token: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<GameInfoResponse | null>(null);
  // Prefill with the name this device used last time. (This screen only renders in the browser.)
  const [name, setName] = useState(() => (typeof window === "undefined" ? "" : (rememberedNames()[0] ?? "")));
  useEffect(() => {
    let live = true;
    fetchGameInfo(gameId)
      .then((result) => live && setInfo(result))
      .catch((caught: unknown) => live && setError(caught instanceof Error ? caught.message : "Couldn't load the game"));
    return () => {
      live = false;
    };
  }, [gameId]);
  if (info && !info.open) {
    return <Message title="This game is full" body="Both seats are taken. Ask your friend for a new invite." />;
  }
  return (
    <Message
      title="You're invited to a game"
      body="Join as Player 2. Your seat is remembered in this browser, so you can close the tab and come back."
    >
      <div className="flex min-h-7 flex-col items-center gap-1.5 text-xs">
        {info ? (
          <>
            <span className="text-stone-500">Game settings</span>
            <SettingsChips settings={info.settings} />
          </>
        ) : error ? null : (
          <span className="text-stone-500">Loading the game settings…</span>
        )}
      </div>
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label="Your name (optional)"
        placeholder="Your name (optional)"
        maxLength={MAX_NAME_LENGTH}
        autoComplete="off"
        spellCheck={false}
        className="w-64 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-center text-sm text-stone-100 placeholder:text-stone-500 focus:border-[var(--brass,#c6a56c)] focus:outline-none"
      />
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const problem = nameProblem(name);
            if (problem) {
              setError(problem);
              setBusy(false);
              return;
            }
            const chosen = cleanName(name);
            if (chosen) rememberNames([chosen, rememberedNames()[1]]);
            onJoined((await joinOnlineGame(gameId, chosen)).token);
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
