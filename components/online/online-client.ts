"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { currentActor, type Action, type GameEvent, type GameState, type PlayerId } from "@/lib/game";
import { captureCards } from "../game/card-motion";
import { NO_NAMES, parseNames, type PlayerNames } from "@/lib/game/names";
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type CreateGameRequest,
  type CreateGameResponse,
  type GameInfoResponse,
  type GameSettings,
  type JoinGameResponse,
  type ServerMessage,
} from "@/lib/online/protocol";

/** The game server (Cloudflare Worker). Unset = online play isn't configured on this deploy. */
export const SERVER_URL = (process.env.NEXT_PUBLIC_PAX_SERVER_URL ?? "").replace(/\/+$/, "");

export function onlineConfigured(): boolean {
  return SERVER_URL.length > 0;
}

type SeatTicket = { seat: PlayerId; token: string };

const ticketKey = (gameId: string) => `pax-online-${gameId}`;

/** This browser's seat in a game, if it has one. */
export function readTicket(gameId: string): SeatTicket | null {
  try {
    const raw = localStorage.getItem(ticketKey(gameId));
    if (!raw) return null;
    const value = JSON.parse(raw) as SeatTicket;
    return (value.seat === 0 || value.seat === 1) && typeof value.token === "string" ? value : null;
  } catch {
    return null;
  }
}

export function saveTicket(gameId: string, ticket: SeatTicket): void {
  try {
    localStorage.setItem(ticketKey(gameId), JSON.stringify(ticket));
  } catch {
    // Without storage the seat only lasts until the tab closes.
  }
}

/** Games this browser has a seat in (newest key order isn't guaranteed; ids only). */
export function listTicketGames(): string[] {
  const ids: string[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith("pax-online-")) ids.push(key.slice("pax-online-".length));
    }
  } catch {
    // No storage: no list.
  }
  return ids.sort();
}

export function forgetTicket(gameId: string): void {
  try {
    localStorage.removeItem(ticketKey(gameId));
  } catch {
    // Nothing to forget.
  }
}

/** A private link that seats whoever opens it in this seat (the token stays out of server logs: it's after #). */
export function rejoinLink(gameId: string, seat: PlayerId, token: string): string {
  return `${window.location.origin}/online/${gameId}#seat=${seat}.${token}`;
}

/** Read a rejoin link's seat from the address bar. */
export function readRejoinHash(): SeatTicket | null {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/^#seat=([01])\.([A-Za-z0-9_-]{16,64})$/);
  return match ? { seat: Number(match[1]) as PlayerId, token: match[2]! } : null;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok || data.error) throw new Error(data.error ?? `Server error ${response.status}`);
  return data;
}

/** What an invite is for, before joining. */
export async function fetchGameInfo(gameId: string): Promise<GameInfoResponse> {
  const response = await fetch(`${SERVER_URL}/api/games/${gameId}`);
  const data = (await response.json()) as GameInfoResponse & { error?: string };
  if (!response.ok || data.error) throw new Error(data.error ?? `Server error ${response.status}`);
  return data;
}

export async function createOnlineGame(settings: CreateGameRequest): Promise<CreateGameResponse> {
  const created = await post<CreateGameResponse>("/api/games", settings);
  saveTicket(created.gameId, { seat: created.seat, token: created.token });
  return created;
}

export async function joinOnlineGame(gameId: string, name?: string | null): Promise<JoinGameResponse> {
  const joined = await post<JoinGameResponse>(`/api/games/${gameId}/join`, name ? { name } : {});
  saveTicket(gameId, { seat: joined.seat, token: joined.token });
  return joined;
}

export type OnlineStatus = "connecting" | "open" | "reconnecting" | "closed";

export type OnlineGame = {
  status: OnlineStatus;
  error: string | null;
  seat: PlayerId | null;
  settings: GameSettings | null;
  state: GameState | null;
  history: GameEvent[];
  canUndo: boolean;
  joined: [boolean, boolean];
  connected: [boolean, boolean];
  names: PlayerNames;
  /** A rematch exists (started by `by`): this seat's ticket for it. */
  rematch: { gameId: string; token: string; by: PlayerId } | null;
  requestRematch: () => void;
  send: (action: Action) => void;
  undo: () => void;
  clearError: () => void;
};

/**
 * One seat's live connection. Reconnects with backoff; the server re-sends
 * the full state on every `hello`, so nothing is lost while offline.
 */
export function useOnlineGame(gameId: string, token: string | null): OnlineGame {
  const [status, setStatus] = useState<OnlineStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{
    seat: PlayerId;
    settings: GameSettings;
    state: GameState;
    history: GameEvent[];
    canUndo: boolean;
  } | null>(null);
  const [presence, setPresence] = useState<{
    joined: [boolean, boolean];
    connected: [boolean, boolean];
    names: PlayerNames;
  }>({
    joined: [true, false],
    connected: [false, false],
    names: NO_NAMES,
  });
  const socket = useRef<WebSocket | null>(null);
  /** The last state shown, so the next update can animate from it. */
  const shown = useRef<GameState | null>(null);
  const [rematch, setRematch] = useState<{ gameId: string; token: string; by: PlayerId } | null>(null);

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;

    const open = () => {
      const ws = new WebSocket(`${SERVER_URL.replace(/^http/, "ws")}/api/games/${gameId}/ws`);
      socket.current = ws;
      ws.addEventListener("open", () => {
        attempt = 0;
        setStatus("open");
        ws.send(JSON.stringify({ t: "hello", token, protocol: PROTOCOL_VERSION } satisfies ClientMessage));
        // Keeps proxies from dropping an idle connection; the server answers without waking the game.
        ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send("ping"), 45_000);
      });
      ws.addEventListener("message", (event) => {
        if (event.data === "pong") return;
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.t === "state") {
          // Animate from the table as it is now (not on the first load: nothing to move from).
          if (shown.current) captureCards(currentActor(shown.current));
          shown.current = message.state;
          setSnapshot((previous) => ({
            seat: message.seat,
            settings: message.settings,
            state: message.state,
            history: message.full || !previous ? message.events : [...previous.history, ...message.events],
            canUndo: message.canUndo,
          }));
          setPresence({ joined: message.joined, connected: message.connected, names: parseNames(message.names) });
        } else if (message.t === "presence") {
          setPresence({ joined: message.joined, connected: message.connected, names: parseNames(message.names) });
        } else if (message.t === "rematch") {
          setRematch({ gameId: message.gameId, token: message.token, by: message.by });
        } else if (message.t === "error") {
          setError(message.message);
        }
      });
      ws.addEventListener("close", (event) => {
        if (ping) clearInterval(ping);
        if (stopped) return;
        if (event.code === 4001) {
          setStatus("closed");
          setError("This browser isn't seated in that game.");
          return;
        }
        setStatus("reconnecting");
        attempt += 1;
        retry = setTimeout(open, Math.min(15_000, 500 * 2 ** attempt));
      });
    };
    open();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      if (ping) clearInterval(ping);
      socket.current?.close();
    };
  }, [gameId, token]);

  const sendMessage = useCallback((message: ClientMessage) => {
    const ws = socket.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
    else setError("Not connected. Reconnecting…");
  }, []);

  return {
    status,
    error,
    seat: snapshot?.seat ?? null,
    settings: snapshot?.settings ?? null,
    state: snapshot?.state ?? null,
    history: snapshot?.history ?? [],
    canUndo: snapshot?.canUndo ?? false,
    joined: presence.joined,
    connected: presence.connected,
    names: presence.names,
    rematch,
    requestRematch: useCallback(() => sendMessage({ t: "rematch" }), [sendMessage]),
    send: useCallback((action: Action) => sendMessage({ t: "action", action }), [sendMessage]),
    undo: useCallback(() => sendMessage({ t: "undo" }), [sendMessage]),
    clearError: useCallback(() => setError(null), []),
  };
}
