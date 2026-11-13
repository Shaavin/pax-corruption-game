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
        <section aria-labelledby="new-game" className="w-full">
          <h2 id="new-game" className="mb-3 text-xs font-semibold tracking-[0.16em] text-stone-400 uppercase">
            New local game
          </h2>
          <ul className="grid grid-cols-2 gap-2 text-left">
            {GAME_MODES.map((mode, index) => (
              <li key={mode.id}>
                <Link
                  href={`/play?mode=${mode.id}`}
                  prefetch={false}
                  className={[
                    "flex h-full flex-col rounded-xl px-3.5 py-3 ring-1 transition-colors",
                    index === 0
                      ? "bg-[var(--brass,#c6a56c)] text-stone-950 ring-transparent hover:bg-[#d4b57c]"
                      : "bg-white/[0.04] text-stone-100 ring-white/12 hover:bg-white/[0.08]",
                  ].join(" ")}
                >
                  <span className="text-sm font-semibold">
                    {mode.name}
                    <span className={index === 0 ? "ml-1.5 text-xs font-normal text-stone-800" : "ml-1.5 text-xs font-normal text-stone-500"}>
                      {mode.term}
                    </span>
                  </span>
                  <span className={index === 0 ? "mt-0.5 text-xs text-stone-800" : "mt-0.5 text-xs text-stone-400"}>
                    {mode.blurb}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <ContinueGame />
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
