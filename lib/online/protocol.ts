/**
 * Online play protocol between the browser and the game server (a Cloudflare
 * Durable Object per game, see server/). Pure types and helpers: no DOM, no
 * Workers APIs, so both sides import it.
 *
 * The server is authoritative: it holds the full state, applies actions with
 * the same engine, and sends each seat a redacted view (lib/game/redact.ts).
 */
import type { Action, GameEvent, GameModeId, GameState, PlayerId } from "../game/types.ts";

export const PROTOCOL_VERSION = 1;

export type GameSettings = {
  mode: GameModeId;
  expansion: boolean;
  foreignInfluence: boolean;
};

// --- HTTP -----------------------------------------------------------------------------------

/** POST /api/games */
export type CreateGameRequest = Partial<GameSettings>;
export type CreateGameResponse = { gameId: string; seat: PlayerId; token: string };

/** POST /api/games/:id/join — claims the second seat. */
export type JoinGameResponse = { gameId: string; seat: PlayerId; token: string };

export type ErrorResponse = { error: string };

// --- WebSocket: GET /api/games/:id/ws -------------------------------------------------------

export type ClientMessage =
  /** First message on every connection. */
  | { t: "hello"; token: string; protocol: number }
  | { t: "action"; action: Action }
  | { t: "undo" }
  | { t: "ping" };

export type ServerMessage =
  | {
      t: "state";
      seat: PlayerId;
      settings: GameSettings;
      /** This seat's view of the game (hidden cards replaced, no seed). */
      state: GameState;
      /** `full`: the whole history (replace); otherwise only new events (append). */
      events: GameEvent[];
      full: boolean;
      /** The last action can be taken back by this seat. */
      canUndo: boolean;
      /** Which seats have joined, and which are connected right now. */
      joined: [boolean, boolean];
      connected: [boolean, boolean];
    }
  | { t: "presence"; joined: [boolean, boolean]; connected: [boolean, boolean] }
  | { t: "error"; message: string }
  | { t: "pong" };

/** Game ids: 10 characters from an unambiguous alphabet. */
export const GAME_ID_PATTERN = /^[a-z2-9]{10}$/;
export const GAME_ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function isGameId(value: string): boolean {
  return GAME_ID_PATTERN.test(value);
}
