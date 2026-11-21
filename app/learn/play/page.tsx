import type { Metadata } from "next";
import { LessonFromUrl } from "@/components/tutorial/LessonFromUrl";

export const metadata: Metadata = {
  title: "Lesson",
  // The lesson list (/learn) is the page worth finding; each lesson is a game table.
  robots: { index: false, follow: true },
};

/** A tutorial lesson at the table. The lesson comes from the address (`?lesson=`). */
export default function LessonPage() {
  return <LessonFromUrl />;
}
