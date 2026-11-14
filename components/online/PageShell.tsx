import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const DISTRICT_COLORS = ["var(--dragonara)", "var(--horsard)", "var(--shavvinne)", "var(--smarbbit)"];

/** The home page's look for the online pages: dark backdrop of the box art, brand mark, centred content. */
export function PageShell({ children, width = "max-w-md" }: { children: ReactNode; width?: string }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip bg-[#0a0c10] text-stone-100">
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image src="/art/box-cover.jpg" alt="" fill sizes="100vw" className="object-cover object-[60%_35%] opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0c10]/80 via-[#0a0c10]/85 to-[#0a0c10]" />
      </div>
      <header className="mx-auto flex w-full max-w-6xl items-center px-5 pt-6 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[0.7rem] font-semibold tracking-[0.22em] text-stone-300 uppercase hover:text-stone-100"
        >
          <span aria-hidden className="flex h-2.5 overflow-hidden rounded-full">
            {DISTRICT_COLORS.map((color) => (
              <span key={color} className="w-2.5" style={{ background: color }} />
            ))}
          </span>
          Pax Corruption
        </Link>
      </header>
      <main className={`mx-auto flex w-full ${width} flex-1 flex-col justify-center gap-6 px-5 py-10`}>{children}</main>
    </div>
  );
}

/** A centred card for short screens (joining, connecting, errors). */
export function ShellCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-[#0d1117]/80 p-6 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-8">
      {children}
    </div>
  );
}
