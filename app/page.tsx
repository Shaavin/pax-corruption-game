import Image from "next/image";
import Link from "next/link";
import { ContinueGame } from "@/components/game/ContinueGame";
import { SeedForm } from "@/components/game/Troubleshooter";
import { GAME_MODES } from "@/lib/game/setup";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#16120e] px-6 text-stone-100">
      <main className="flex max-w-md flex-col items-center gap-8 text-center">
        <Image
          src="/cards/backs/common.png"
          alt=""
          width={165}
          height={225}
          className="rounded-sm shadow-[0_18px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
          priority
        />
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Pax Corruption</h1>
          <p className="mt-2 text-stone-400">
            Two players, one device. Local hotseat first.
          </p>
        </div>
        <form action="/play" method="get" aria-labelledby="new-game" className="flex w-full flex-col gap-3">
          <h2 id="new-game" className="text-xs font-semibold tracking-[0.16em] text-stone-400 uppercase">
            New local game
          </h2>
          <fieldset className="grid grid-cols-2 gap-2 text-left">
            <legend className="sr-only">Draw-deck mode</legend>
            {GAME_MODES.map((mode, index) => (
              <label
                key={mode.id}
                className="flex h-full cursor-pointer flex-col rounded-xl bg-white/[0.04] px-3.5 py-3 text-stone-100 ring-1 ring-white/12 transition-colors hover:bg-white/[0.08] has-[:checked]:bg-[var(--brass,#c6a56c)] has-[:checked]:text-stone-950 has-[:checked]:ring-transparent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-white"
              >
                <input type="radio" name="mode" value={mode.id} defaultChecked={index === 0} className="sr-only" />
                <span className="text-sm font-semibold">
                  {mode.name}
                  <span className="ml-1.5 text-xs font-normal opacity-70">{mode.term}</span>
                </span>
                <span className="mt-0.5 text-xs opacity-80">{mode.blurb}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-1.5 rounded-xl bg-white/[0.03] px-3.5 py-3 text-left text-sm ring-1 ring-white/10">
            <legend className="sr-only">Expansion</legend>
            <label className="flex cursor-pointer items-start gap-2">
              <input type="checkbox" name="expansion" value="1" className="mt-1 accent-[var(--brass,#c6a56c)]" />
              <span>
                <span className="font-semibold text-stone-100">Legacy &amp; Diplomacy</span>
                <span className="block text-xs text-stone-400">
                  Expansion: buy World Power events, build relations, and unlock victories with legacy events.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 pl-6">
              <input type="checkbox" name="fi" value="1" className="mt-1 accent-[var(--brass,#c6a56c)]" />
              <span>
                <span className="text-stone-200">Foreign Influence variant</span>
                <span className="block text-xs text-stone-400">Start with 3 random events already in play.</span>
              </span>
            </label>
          </fieldset>
          <button
            type="submit"
            className="cursor-pointer rounded-full bg-[var(--brass,#c6a56c)] px-6 py-3 text-sm font-semibold tracking-wide text-stone-950 transition-colors hover:bg-[#d4b57c]"
          >
            Start game
          </button>
        </form>
        <ContinueGame />
        <Link
          href="/online"
          prefetch={false}
          className="rounded-full px-6 py-3 text-sm font-semibold tracking-wide text-stone-100 ring-1 ring-white/20 transition-colors hover:bg-white/8"
        >
          Play online
        </Link>
        <p className="text-sm text-stone-500">Play civil, draw, pass the device</p>
        <details className="w-full text-sm text-stone-400">
          <summary className="cursor-pointer select-none hover:text-stone-200">More options</summary>
          <div className="mt-3 flex flex-col items-center gap-3">
            <SeedForm />
            <Link href="/troubleshoot" prefetch={false} className="underline hover:text-stone-200">
              Troubleshooting: replay a bug report or game record
            </Link>
          </div>
        </details>
      </main>
    </div>
  );
}
