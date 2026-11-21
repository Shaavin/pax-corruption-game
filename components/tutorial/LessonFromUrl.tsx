"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { TutorialSession } from "./TutorialSession";
import { getLesson } from "@/lib/tutorial";

const noSubscribe = () => () => {};

/**
 * `/learn/play?lesson=<id>`: one lesson at the table. Like `/play`, the page is the same for
 * every lesson (it reads the address in the browser), so the installed app opens it offline.
 */
export function LessonFromUrl() {
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => null);
  if (search === null) return <div className="min-h-dvh bg-[#0a0c10]" aria-busy="true" />;
  const lesson = getLesson(new URLSearchParams(search).get("lesson"));
  if (!lesson) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0a0c10] px-6 text-center text-stone-200">
        <p className="text-lg font-semibold">That lesson doesn&apos;t exist.</p>
        <Link href="/learn" className="text-stamp-blue underline-offset-4 hover:underline">
          See all lessons
        </Link>
      </div>
    );
  }
  return <TutorialSession lesson={lesson} />;
}
