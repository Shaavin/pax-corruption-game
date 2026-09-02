import Image from "next/image";
import Link from "next/link";

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
        <Link
          href="/play"
          prefetch={false}
          className="rounded-full bg-[var(--brass,#c6a56c)] px-6 py-3 text-sm font-semibold tracking-wide text-stone-950 transition-colors hover:bg-[#d4b57c]"
        >
          New local game
        </Link>
        <p className="text-sm text-stone-500">
          Standard · play civil, draw, pass the device
        </p>
      </main>
    </div>
  );
}
