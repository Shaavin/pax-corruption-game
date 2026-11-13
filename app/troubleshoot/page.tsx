import type { Metadata } from "next";
import { Troubleshooter } from "@/components/game/Troubleshooter";

export const metadata: Metadata = {
  title: "Troubleshooting",
  robots: { index: false, follow: true },
};

export default function TroubleshootPage() {
  return <Troubleshooter />;
}
