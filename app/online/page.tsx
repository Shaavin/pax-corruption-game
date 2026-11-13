import type { Metadata } from "next";
import { OnlineLobby } from "@/components/online/OnlineLobby";

export const metadata: Metadata = {
  title: "Play online with a friend",
  description:
    "Start an online game of Pax Corruption and send your opponent a link. Each player uses their own device, and your hand stays private. Free, no account needed.",
  alternates: { canonical: "/online" },
  openGraph: {
    url: "/online",
    title: "Play Pax Corruption online with a friend",
    description: "Start a game, send a link, and play on your own devices. Free, no account needed.",
  },
};

export default function OnlinePage() {
  return <OnlineLobby />;
}
