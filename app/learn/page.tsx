import type { Metadata } from "next";
import Link from "next/link";
import { LessonHub } from "@/components/tutorial/LessonHub";

export const metadata: Metadata = {
  title: "Learn to play",
  description:
    "Learn Pax Corruption in short lessons at a real table: civil cards, conspiracies, alliances, the Senate, elections, and every victory, against the computer.",
  alternates: { canonical: "/learn" },
  openGraph: { url: "/learn" },
};

const DISTRICT_COLORS = ["var(--shavvinne)", "var(--horsard)", "var(--dragonara)", "var(--smarbbit)"];

/** The tutorial's lesson list. Progress is kept in the browser. */
export default function LearnPage() {
  return (
    <div className="min-h-dvh bg-[#0a0c10] text-stone-100">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 pt-6 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[0.7rem] font-semibold tracking-[0.22em] text-stone-300 uppercase hover:text-stone-100"
        >
          <span aria-hidden className="flex h-2.5 overflow-hidden rounded-full">
            {DISTRICT_COLORS.map((color) => (
              <span key={color} className="w-2.5" style={{ background: color }} />
            ))}
          </span>
          <span>
            <span className="text-ember">Pax</span> <span className="text-stamp-blue">Corruption</span>
          </span>
        </Link>
        <Link href="/" className="text-sm text-stone-400 hover:text-stone-100">
          <span aria-hidden>←</span> Menu
        </Link>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <LessonHub />
      </main>
    </div>
  );
}
