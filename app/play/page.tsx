import type { Metadata } from "next";
import { PlayFromUrl } from "@/components/game/PlayFromUrl";

export const metadata: Metadata = {
  title: "Game table",
  // Each table is a fresh random game: nothing for search to index.
  robots: { index: false, follow: true },
};

/**
 * The game table. The page is the same for every game (it reads its setup from the address
 * in the browser), so it's static and the installed app can open it offline.
 */
export default function PlayPage() {
  return <PlayFromUrl />;
}
