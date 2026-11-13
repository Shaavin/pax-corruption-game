import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OnlineGameView } from "@/components/online/OnlineGameView";
import { isGameId } from "@/lib/online/protocol";

export const metadata: Metadata = {
  title: "Online game",
};

export default async function OnlineGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isGameId(id)) notFound();
  return (
    <div className="h-full overflow-hidden">
      <OnlineGameView gameId={id} />
    </div>
  );
}
