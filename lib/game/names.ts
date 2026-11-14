import type { PlayerId } from "./types.ts";

/** Optional display names, by seat. Purely cosmetic: the engine never reads them. */
export type PlayerNames = readonly [string | null, string | null];

export const NO_NAMES: PlayerNames = [null, null];
export const MAX_NAME_LENGTH = 20;

/** Trim, collapse spaces, drop control characters, cap the length. Empty → null. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return name.length > 0 ? name : null;
}

/** Names from untrusted JSON (records, server messages). */
export function parseNames(raw: unknown): PlayerNames {
  if (!Array.isArray(raw)) return NO_NAMES;
  return [cleanName(raw[0]), cleanName(raw[1])];
}

export function hasNames(names: PlayerNames | undefined): names is PlayerNames {
  return Boolean(names && (names[0] || names[1]));
}

/** "Ann", or "Player 1" when the seat has no name. */
export function playerName(names: PlayerNames | undefined, player: PlayerId): string {
  return names?.[player] ?? `Player ${player + 1}`;
}
