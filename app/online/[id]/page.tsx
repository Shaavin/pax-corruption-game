import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OnlineGameView } from "@/components/online/OnlineGameView";
import { isGameId } from "@/lib/online/protocol";

export const metadata: Metadata = {
  title: "Online game",
  description: "You're invited to a game of Pax Corruption. Join in your browser, no account needed.",
  // Private game rooms: shareable, never indexed.
  robots: { index: false, follow: false },
  openGraph: {
    title: "Join my game of Pax Corruption",
    description: "You're invited to a two-player game. Open the link to take your seat; no account needed.",
  },
  twitter: {
    title: "Join my game of Pax Corruption",
    description: "You're invited to a two-player game. Open the link to take your seat; no account needed.",
  },
};

export default async function OnlineGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isGameId(id)) notFound();
  return (
    <div className="h-full overflow-hidden">
      <OnlineGameView key={id} gameId={id} />
    </div>
  );
}
