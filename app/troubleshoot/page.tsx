import type { Metadata } from "next";
import { Troubleshooter } from "@/components/game/Troubleshooter";

export const metadata: Metadata = {
  title: "Troubleshooting",
};

export default function TroubleshootPage() {
  return <Troubleshooter />;
}
