import type { PlayerId } from "@/lib/game/types";

export function playerLabel(player: PlayerId): string {
  return `Player ${player + 1}`;
}
