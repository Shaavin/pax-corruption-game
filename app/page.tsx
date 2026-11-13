import Image from "next/image";
import Link from "next/link";
import { HomeLauncher } from "@/components/home/HomeLauncher";
import { SeedForm } from "@/components/game/Troubleshooter";

const DISTRICTS = [
  { name: "Dragonara", theme: "the Technocrats", color: "var(--dragonara)" },
  { name: "Horsard", theme: "the Prosperous", color: "var(--horsard)" },
  { name: "Shavvinne", theme: "the Divine", color: "var(--shavvinne)" },
  { name: "Smarbbit", theme: "the Vocals", color: "var(--smarbbit)" },
] as const;

/** The game's own site: what it is, the rulebook, and how to get a physical copy. */
const MARKETING_SITE = "https://pax-corruption-marketing.vercel.app/";
const GET_A_COPY = `${MARKETING_SITE}#request`;

export default function Home() {
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-[#0a0c10] text-stone-100">
      {/* Backdrop: the box art, darkened toward the reading side. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image
          src="/art/box-cover.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[60%_35%] opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0c10]/70 via-[#0a0c10]/80 to-[#0a0c10] lg:bg-gradient-to-r lg:from-[#0a0c10] lg:from-30% lg:via-[#0a0c10]/90 lg:via-55% lg:to-[#0a0c10]/40" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0a0c10] to-transparent" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-6 sm:px-8">
        <span className="flex items-center gap-2.5 text-[0.7rem] font-semibold tracking-[0.22em] text-stone-300 uppercase">
          <span aria-hidden className="flex h-2.5 overflow-hidden rounded-full">
            {DISTRICTS.map((district) => (
              <span key={district.name} className="w-2.5" style={{ background: district.color }} />
            ))}
          </span>
          Pax Corruption
        </span>
        <nav aria-label="Site" className="flex items-center gap-5 text-sm text-stone-400">
          <a href={MARKETING_SITE} className="hidden transition hover:text-stone-100 sm:inline">
            About the game
          </a>
          <a
            href={GET_A_COPY}
            className="rounded-full border border-white/15 px-3.5 py-1.5 font-medium text-stone-100 transition hover:border-white/30 hover:bg-white/[0.06]"
          >
            Get a copy
          </a>
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-12 sm:px-8 lg:min-h-[calc(100dvh-9rem)] lg:grid-cols-[minmax(0,1fr)_27rem] lg:gap-x-16 lg:gap-y-8 lg:py-10">
        <div className="max-w-xl lg:self-end">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-stone-300 backdrop-blur">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--brass)]" />
            A two-player political card game
          </p>
          <h1 className="mt-5 text-6xl leading-[0.92] font-semibold tracking-[-0.035em] sm:text-7xl lg:text-8xl">
            Pax
            <br />
            <span className="bg-gradient-to-r from-[#f1d9a6] via-[var(--brass)] to-[#a5824a] bg-clip-text text-transparent">
              Corruption
            </span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-stone-300 sm:text-lg">
            Two rival parties fight over a city of four districts. Play civil cards, forge alliances, sway the Senate,
            and steer the elections toward one of five victories.
          </p>

          <ul aria-label="Districts" className="mt-8 grid max-w-md grid-cols-2 gap-2 sm:gap-2.5">
            {DISTRICTS.map((district) => (
              <li
                key={district.name}
                className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 backdrop-blur"
              >
                <span
                  aria-hidden
                  className="h-7 w-1 rounded-full"
                  style={{ background: district.color, boxShadow: `0 0 14px ${district.color}` }}
                />
                <span className="leading-tight">
                  <span className="block text-sm font-semibold text-stone-100">{district.name}</span>
                  <span className="block text-xs text-stone-400">{district.theme}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <HomeLauncher />
        </div>

        <div className="flex max-w-md flex-col gap-3 self-start rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-snug text-stone-300">
            Prefer cards on a real table?
            <span className="block text-xs text-stone-500">The physical game, rulebook, and more.</span>
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <a
              href={MARKETING_SITE}
              className="text-sm text-stone-300 underline-offset-4 transition hover:text-stone-100 hover:underline"
            >
              Learn more
            </a>
            <a
              href={GET_A_COPY}
              className="rounded-xl bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-white"
            >
              Get a copy <span aria-hidden>→</span>
            </a>
          </div>
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
        <details className="group border-t border-white/[0.08] pt-5 text-sm text-stone-500">
          <summary className="flex cursor-pointer list-none items-center gap-2 select-none hover:text-stone-300 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="transition group-open:rotate-90">›</span>
            Advanced: start from a seed, troubleshoot a game
          </summary>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <SeedForm />
            <Link href="/troubleshoot" prefetch={false} className="text-stone-400 underline-offset-4 hover:text-stone-200 hover:underline">
              Replay a bug report or game record →
            </Link>
          </div>
        </details>
      </footer>
    </div>
  );
}
