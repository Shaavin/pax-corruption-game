import type { Metadata } from "next";
import { OnlineLobby } from "@/components/online/OnlineLobby";

export const metadata: Metadata = {
  title: "Play online",
};

export default function OnlinePage() {
  return <OnlineLobby />;
}
